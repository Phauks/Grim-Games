import { DurableObject } from 'cloudflare:workers';
import {
	DAY_MS,
	INVITE_TTL_MS,
	INVITES_PER_DAY,
	MAX_INVITES,
	MAX_RECENT,
	PRESENCE_TTL_MS,
	REQUEST_TTL_MS,
	type RequestRefusal
} from '../../src/lib/features/friends/friends-protocol.ts';
import {
	MAX_INBOX,
	MAX_PUBLISHED,
	type FriendScript,
	type PublishedScript
} from '../../src/lib/features/friends/friend-scripts-protocol.ts';
import {
	planReceive,
	planSend,
	type BookCounts,
	type GamePlayer,
	type Relation
} from '../../src/lib/features/friends/friend-rules.ts';

/** One other account in a list, by id, with when that link began. */
export interface BookEntry {
	id: string;
	at: number;
}

/** Everything one account's book holds. */
export interface BookContents {
	friends: BookEntry[];
	incoming: BookEntry[];
	outgoing: BookEntry[];
	blocked: BookEntry[];
	findable: boolean;
}

/** Someone this account finished a game with (plan F3). */
export interface RecentEntry extends BookEntry {
	name?: string;
	games: number;
}

/** A friend's invite to their live room (plan F4), by the sender's id. */
export interface InviteEntry {
	id: number;
	sender: string;
	code: string;
	title: string;
	at: number;
}

/** A script a friend sent, by the sender's id. */
export interface InboxEntry extends FriendScript {
	id: number;
	sender: string;
	at: number;
}

/** The asker's side of a request: what the route must then ask the other account to do. */
export type SendResult =
	{ ok: false; reason: RequestRefusal } | { ok: true; next: 'receive' | 'befriend' };

/**
 * One account's friends (plan F1), named by the account's id: friendships, requests both
 * ways, blocks and its friend settings. Kept apart from `AccountUser` so friends never
 * touches the account's own storage. Each link is a row on both accounts' books; the route
 * (worker/friends/routes.ts) writes the asker's side first, then the other's, and every
 * method is safe to run twice.
 */
export class FriendBook extends DurableObject {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS friend (id TEXT PRIMARY KEY, since INTEGER NOT NULL);
			-- direction 'in': the other asked this account; 'out': this account asked.
			CREATE TABLE IF NOT EXISTS request (
				id TEXT PRIMARY KEY,
				direction TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS block (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
			-- When each request was sent, for the day's limit; cancelling one doesn't give it back.
			CREATE TABLE IF NOT EXISTS sent (at INTEGER NOT NULL);
			CREATE TABLE IF NOT EXISTS settings (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				findable INTEGER NOT NULL
			);
			-- Scripts friends sent (plan F9), and scripts on this account's profile (F10).
			CREATE TABLE IF NOT EXISTS inbox (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				sender TEXT NOT NULL,
				name TEXT NOT NULL,
				hash TEXT NOT NULL,
				sent_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS published (
				hash TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				published_at INTEGER NOT NULL
			);
			-- People this account finished a game with (plan F3): their name in the last one,
			-- that game's id (so it counts once) and how many games they played together.
			CREATE TABLE IF NOT EXISTS recent (
				id TEXT PRIMARY KEY,
				name TEXT,
				game TEXT NOT NULL,
				games INTEGER NOT NULL,
				last_at INTEGER NOT NULL
			);
			-- Friends' invites to their live rooms (plan F4): one per sender and room.
			CREATE TABLE IF NOT EXISTS invite (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				sender TEXT NOT NULL,
				code TEXT NOT NULL,
				title TEXT NOT NULL,
				sent_at INTEGER NOT NULL,
				UNIQUE (sender, code)
			);
			-- When each invite this account sent went, for the day's limit.
			CREATE TABLE IF NOT EXISTS invited (at INTEGER NOT NULL);
			-- Live rooms this account is connected to (plan F5), and whether friends see it.
			CREATE TABLE IF NOT EXISTS playing (code TEXT PRIMARY KEY, at INTEGER NOT NULL);
			CREATE TABLE IF NOT EXISTS presence (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				shown INTEGER NOT NULL
			);
		`);
	}

	private entries(query: string, ...args: SqlStorageValue[]): BookEntry[] {
		return this.sql
			.exec<{ id: string; at: number }>(query, ...args)
			.toArray()
			.map(({ id, at }) => ({ id, at }));
	}

	/** Drops requests nobody answered in time. */
	private expire(now: number): void {
		this.sql.exec('DELETE FROM request WHERE created_at < ?', now - REQUEST_TTL_MS);
		this.sql.exec('DELETE FROM sent WHERE at < ?', now - DAY_MS);
	}

	private relation(id: string): Relation {
		const has = (query: string, ...args: SqlStorageValue[]) =>
			this.sql.exec(query, ...args).toArray().length > 0;
		return {
			friend: has('SELECT 1 FROM friend WHERE id = ?', id),
			incoming: has("SELECT 1 FROM request WHERE id = ? AND direction = 'in'", id),
			outgoing: has("SELECT 1 FROM request WHERE id = ? AND direction = 'out'", id),
			blocked: has('SELECT 1 FROM block WHERE id = ?', id)
		};
	}

	private counts(): BookCounts {
		const count = (query: string) => this.sql.exec<{ n: number }>(query).one().n;
		return {
			friends: count('SELECT COUNT(*) AS n FROM friend'),
			pending: count('SELECT COUNT(*) AS n FROM request'),
			sentToday: count('SELECT COUNT(*) AS n FROM sent')
		};
	}

	private addFriend(id: string, now: number): void {
		this.sql.exec('DELETE FROM request WHERE id = ?', id);
		this.sql.exec('INSERT OR IGNORE INTO friend (id, since) VALUES (?, ?)', id, now);
	}

	/** Findable by username unless turned off (Trevor, 2026-10-29: on by default). */
	async isFindable(): Promise<boolean> {
		const row = this.sql
			.exec<{ findable: number }>('SELECT findable FROM settings WHERE id = 1')
			.toArray()[0];
		return row ? row.findable === 1 : true;
	}

	async setFindable(findable: boolean): Promise<void> {
		this.sql.exec('INSERT OR REPLACE INTO settings (id, findable) VALUES (1, ?)', findable ? 1 : 0);
	}

	async contents(now: number): Promise<BookContents> {
		this.expire(now);
		return {
			friends: this.entries('SELECT id, since AS at FROM friend ORDER BY since DESC'),
			incoming: this.entries(
				"SELECT id, created_at AS at FROM request WHERE direction = 'in' ORDER BY created_at DESC"
			),
			outgoing: this.entries(
				"SELECT id, created_at AS at FROM request WHERE direction = 'out' ORDER BY created_at DESC"
			),
			blocked: this.entries('SELECT id, created_at AS at FROM block ORDER BY created_at DESC'),
			findable: await this.isFindable()
		};
	}

	/** This account asks `id`. */
	async send(id: string, now: number): Promise<SendResult> {
		this.expire(now);
		const plan = planSend(this.relation(id), this.counts());
		if (plan.kind === 'refuse') return { ok: false, reason: plan.reason };
		if (plan.kind === 'accept') {
			this.addFriend(id, now);
			return { ok: true, next: 'befriend' };
		}
		if (plan.counts) {
			this.sql.exec('INSERT INTO sent (at) VALUES (?)', now);
			this.sql.exec(
				"INSERT OR REPLACE INTO request (id, direction, created_at) VALUES (?, 'out', ?)",
				id,
				now
			);
		}
		return { ok: true, next: 'receive' };
	}

	/** `id` asked this account. True when both had asked, so they are now friends. */
	async receive(id: string, now: number): Promise<boolean> {
		this.expire(now);
		const plan = planReceive(this.relation(id), this.counts());
		if (plan === 'friends') {
			this.addFriend(id, now);
			return true;
		}
		if (plan === 'store') {
			this.sql.exec(
				"INSERT OR IGNORE INTO request (id, direction, created_at) VALUES (?, 'in', ?)",
				id,
				now
			);
		}
		return false;
	}

	/** `id` and this account are friends: the other side of an accept. False if blocked since. */
	async befriend(id: string, now: number): Promise<boolean> {
		if (this.relation(id).blocked) return false;
		this.addFriend(id, now);
		return true;
	}

	/** Accepts `id`'s request. False when there was none. */
	async accept(id: string, now: number): Promise<boolean> {
		if (!this.relation(id).incoming) return false;
		this.addFriend(id, now);
		return true;
	}

	/** Declines `id`'s request. The asker isn't told: theirs waits until it expires. */
	async decline(id: string): Promise<void> {
		this.sql.exec("DELETE FROM request WHERE id = ? AND direction = 'in'", id);
	}

	/** Withdraws this account's request to `id`. */
	async cancel(id: string): Promise<boolean> {
		const had = this.relation(id).outgoing;
		this.sql.exec("DELETE FROM request WHERE id = ? AND direction = 'out'", id);
		return had;
	}

	/** Ends a friendship from this side. */
	async unfriend(id: string): Promise<boolean> {
		const had = this.relation(id).friend;
		this.sql.exec('DELETE FROM friend WHERE id = ?', id);
		return had;
	}

	/**
	 * The other side of a cancel, unfriend or block by `id`: the friendship and `id`'s request
	 * here go. This account's own request to `id` stays, so a block isn't given away.
	 */
	async drop(id: string): Promise<void> {
		this.sql.exec('DELETE FROM friend WHERE id = ?', id);
		this.sql.exec("DELETE FROM request WHERE id = ? AND direction = 'in'", id);
	}

	/** Blocks `id`: any friendship and requests between them end, and its scripts go. */
	async block(id: string, now: number): Promise<void> {
		this.sql.exec('DELETE FROM friend WHERE id = ?', id);
		this.sql.exec('DELETE FROM recent WHERE id = ?', id);
		this.sql.exec('DELETE FROM invite WHERE sender = ?', id);
		this.sql.exec('DELETE FROM inbox WHERE sender = ?', id);
		this.sql.exec('DELETE FROM request WHERE id = ?', id);
		this.sql.exec('INSERT OR IGNORE INTO block (id, created_at) VALUES (?, ?)', id, now);
	}

	async unblock(id: string): Promise<void> {
		this.sql.exec('DELETE FROM block WHERE id = ?', id);
	}

	/** What this account holds about `id`. */
	async relationTo(id: string): Promise<Relation> {
		return this.relation(id);
	}

	/** Whether this account holds anything about `id`, so actions only reach those. */
	async knows(id: string): Promise<boolean> {
		const relation = this.relation(id);
		return relation.friend || relation.incoming || relation.outgoing || relation.blocked;
	}

	/** `id` was deleted: everything about it goes. */
	async forget(id: string): Promise<void> {
		this.sql.exec('DELETE FROM friend WHERE id = ?', id);
		this.sql.exec('DELETE FROM request WHERE id = ?', id);
		this.sql.exec('DELETE FROM block WHERE id = ?', id);
		this.sql.exec('DELETE FROM inbox WHERE sender = ?', id);
		this.sql.exec('DELETE FROM recent WHERE id = ?', id);
		this.sql.exec('DELETE FROM invite WHERE sender = ?', id);
	}

	/** This account connected to the live room `code` (plan F5). */
	async joinedRoom(code: string, now: number): Promise<void> {
		this.sql.exec('INSERT OR REPLACE INTO playing (code, at) VALUES (?, ?)', code, now);
	}

	/** This account's last device left the room `code`. */
	async leftRoom(code: string): Promise<void> {
		this.sql.exec('DELETE FROM playing WHERE code = ?', code);
	}

	/** Shown to friends unless turned off (Trevor approved the plan's switch, 2026-10-28). */
	async showsPresence(): Promise<boolean> {
		const row = this.sql
			.exec<{ shown: number }>('SELECT shown FROM presence WHERE id = 1')
			.toArray()[0];
		return row ? row.shown === 1 : true;
	}

	async setShowsPresence(shown: boolean): Promise<void> {
		this.sql.exec('INSERT OR REPLACE INTO presence (id, shown) VALUES (1, ?)', shown ? 1 : 0);
	}

	/** The rooms this account is in, latest first; none while it hides its presence. */
	async rooms(now: number): Promise<string[]> {
		this.sql.exec('DELETE FROM playing WHERE at < ?', now - PRESENCE_TTL_MS);
		if (!(await this.showsPresence())) return [];
		return this.sql
			.exec<{ code: string }>('SELECT code FROM playing ORDER BY at DESC')
			.toArray()
			.map((row) => row.code);
	}

	/** Counts an invite this account sends against the day's limit; false when it is used up. */
	async spendInvite(now: number): Promise<boolean> {
		this.sql.exec('DELETE FROM invited WHERE at < ?', now - DAY_MS);
		const sent = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM invited').one().n;
		if (sent >= INVITES_PER_DAY) return false;
		this.sql.exec('INSERT INTO invited (at) VALUES (?)', now);
		return true;
	}

	/**
	 * A friend, `from`, invites this account to their room (plan F4). False unless they are
	 * friends. A second invite to the same room replaces the first.
	 */
	async receiveInvite(
		from: string,
		invite: { code: string; title: string },
		now: number
	): Promise<boolean> {
		const relation = this.relation(from);
		if (!relation.friend || relation.blocked) return false;
		this.sql.exec(
			`INSERT INTO invite (sender, code, title, sent_at) VALUES (?, ?, ?, ?)
			ON CONFLICT (sender, code) DO UPDATE SET title = excluded.title, sent_at = excluded.sent_at`,
			from,
			invite.code,
			invite.title,
			now
		);
		this.sql.exec(
			'DELETE FROM invite WHERE id NOT IN (SELECT id FROM invite ORDER BY sent_at DESC LIMIT ?)',
			MAX_INVITES
		);
		return true;
	}

	/** Invites still open, newest first. */
	async invites(now: number): Promise<InviteEntry[]> {
		this.sql.exec('DELETE FROM invite WHERE sent_at < ?', now - INVITE_TTL_MS);
		return this.sql
			.exec<{ id: number; sender: string; code: string; title: string; at: number }>(
				'SELECT id, sender, code, title, sent_at AS at FROM invite ORDER BY sent_at DESC'
			)
			.toArray()
			.map(({ id, sender, code, title, at }) => ({ id, sender, code, title, at }));
	}

	async dismissInvite(id: number): Promise<void> {
		this.sql.exec('DELETE FROM invite WHERE id = ?', id);
	}

	/**
	 * This account finished game `game` with `others` (plan F3). Safe to run twice: a game
	 * counts once per person. Someone this account blocked isn't kept; the newest are.
	 */
	async played(game: string, others: GamePlayer[], now: number): Promise<void> {
		for (const other of others) {
			if (this.relation(other.id).blocked) continue;
			this.sql.exec(
				`INSERT INTO recent (id, name, game, games, last_at) VALUES (?, ?, ?, 1, ?)
				ON CONFLICT (id) DO UPDATE SET
					games = games + (CASE WHEN game = excluded.game THEN 0 ELSE 1 END),
					name = excluded.name, game = excluded.game, last_at = excluded.last_at`,
				other.id,
				other.name ?? null,
				game,
				now
			);
		}
		this.sql.exec(
			'DELETE FROM recent WHERE id NOT IN (SELECT id FROM recent ORDER BY last_at DESC LIMIT ?)',
			MAX_RECENT
		);
	}

	/** People this account finished a game with, the latest first. */
	async recent(): Promise<RecentEntry[]> {
		return this.sql
			.exec<{ id: string; name: string | null; games: number; at: number }>(
				'SELECT id, name, games, last_at AS at FROM recent ORDER BY last_at DESC'
			)
			.toArray()
			.map(({ id, name, games, at }) => (name ? { id, name, games, at } : { id, games, at }));
	}

	/** Whether this account finished a game with `id`, so Recent players may reach it. */
	async playedWith(id: string): Promise<boolean> {
		return this.sql.exec('SELECT 1 FROM recent WHERE id = ?', id).toArray().length > 0;
	}

	/** A friend, `from`, sends this account a script. False unless they are friends. */
	async receiveScript(from: string, script: FriendScript, now: number): Promise<boolean> {
		const relation = this.relation(from);
		if (!relation.friend || relation.blocked) return false;
		this.sql.exec(
			'INSERT INTO inbox (sender, name, hash, sent_at) VALUES (?, ?, ?, ?)',
			from,
			script.name,
			script.hash,
			now
		);
		this.sql.exec(
			'DELETE FROM inbox WHERE id NOT IN (SELECT id FROM inbox ORDER BY id DESC LIMIT ?)',
			MAX_INBOX
		);
		return true;
	}

	/** Scripts friends sent, newest first. */
	async inbox(): Promise<InboxEntry[]> {
		return this.sql
			.exec<{ id: number; sender: string; name: string; hash: string; at: number }>(
				'SELECT id, sender, name, hash, sent_at AS at FROM inbox ORDER BY id DESC'
			)
			.toArray()
			.map(({ id, sender, name, hash, at }) => ({ id, sender, name, hash, at }));
	}

	async dismissScript(id: number): Promise<void> {
		this.sql.exec('DELETE FROM inbox WHERE id = ?', id);
	}

	/** Shows a script on this account's profile; false when the profile is full. */
	async publish(script: FriendScript, now: number): Promise<boolean> {
		const count = this.sql
			.exec<{ n: number }>('SELECT COUNT(*) AS n FROM published WHERE hash != ?', script.hash)
			.one().n;
		if (count >= MAX_PUBLISHED) return false;
		this.sql.exec(
			'INSERT OR REPLACE INTO published (hash, name, published_at) VALUES (?, ?, ?)',
			script.hash,
			script.name,
			now
		);
		return true;
	}

	async unpublish(hash: string): Promise<void> {
		this.sql.exec('DELETE FROM published WHERE hash = ?', hash);
	}

	/** The scripts on this account's profile, newest first. */
	async published(): Promise<PublishedScript[]> {
		return this.sql
			.exec<{ name: string; hash: string; at: number }>(
				'SELECT name, hash, published_at AS at FROM published ORDER BY published_at DESC'
			)
			.toArray()
			.map(({ name, hash, at }) => ({ name, hash, at }));
	}

	/** This account was deleted: returns everyone it was linked to, and keeps nothing. */
	async erase(): Promise<string[]> {
		const ids = this.sql
			.exec<{ id: string }>(
				'SELECT id FROM friend UNION SELECT id FROM request UNION SELECT id FROM block UNION SELECT id FROM recent'
			)
			.toArray()
			.map((row) => row.id);
		await this.ctx.storage.deleteAll();
		return ids;
	}
}
