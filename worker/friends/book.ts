import { DurableObject } from 'cloudflare:workers';
import {
	DAY_MS,
	REQUEST_TTL_MS,
	type RequestRefusal
} from '../../src/lib/features/friends/friends-protocol.ts';
import {
	planReceive,
	planSend,
	type BookCounts,
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

	/** Blocks `id`: any friendship and requests between them end. */
	async block(id: string, now: number): Promise<void> {
		this.sql.exec('DELETE FROM friend WHERE id = ?', id);
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
	}

	/** This account was deleted: returns everyone it was linked to, and keeps nothing. */
	async erase(): Promise<string[]> {
		const ids = this.sql
			.exec<{ id: string }>(
				'SELECT id FROM friend UNION SELECT id FROM request UNION SELECT id FROM block'
			)
			.toArray()
			.map((row) => row.id);
		await this.ctx.storage.deleteAll();
		return ids;
	}
}
