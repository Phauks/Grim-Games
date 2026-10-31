import { DurableObject } from 'cloudflare:workers';
import {
	GROUP_GAME_TTL_MS,
	MAX_GROUP_MEMBERS
} from '../../src/lib/features/friends/groups-protocol.ts';

/** What a group holds about itself. */
export interface GroupInfo {
	name: string;
	owner: string;
	members: number;
}

/** A live room a Storyteller shows in the group. */
export interface GroupRoom {
	room: string;
	storyteller: string;
	title: string;
	at: number;
}

/**
 * One group (plan F6), named by its join code: its name, who started it, its members and the
 * live rooms Storytellers show in it. Each member's FriendBook lists the group's code too; the
 * route (worker/friends/groups.ts) writes both, and every method is safe to run twice.
 */
export class FriendGroup extends DurableObject {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS info (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				name TEXT NOT NULL,
				owner TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS member (id TEXT PRIMARY KEY, joined_at INTEGER NOT NULL);
			CREATE TABLE IF NOT EXISTS room (
				room TEXT PRIMARY KEY,
				storyteller TEXT NOT NULL,
				title TEXT NOT NULL,
				at INTEGER NOT NULL
			);
		`);
	}

	/** Starts the group with its owner as its first member; false when the code is taken. */
	async create(owner: string, name: string, now: number): Promise<boolean> {
		if (this.sql.exec('SELECT 1 FROM info').toArray().length) return false;
		this.sql.exec(
			'INSERT INTO info (id, name, owner, created_at) VALUES (1, ?, ?, ?)',
			name,
			owner,
			now
		);
		this.sql.exec('INSERT OR IGNORE INTO member (id, joined_at) VALUES (?, ?)', owner, now);
		return true;
	}

	/** The group, or undefined when there is none by this code. */
	async info(): Promise<GroupInfo | undefined> {
		const row = this.sql
			.exec<{ name: string; owner: string }>('SELECT name, owner FROM info')
			.toArray()[0];
		if (!row) return undefined;
		const members = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM member').one().n;
		return { name: row.name, owner: row.owner, members };
	}

	async isMember(id: string): Promise<boolean> {
		return this.sql.exec('SELECT 1 FROM member WHERE id = ?', id).toArray().length > 0;
	}

	/** Adds a member: 'missing' with no group by this code, 'full' at the member limit. */
	async join(id: string, now: number): Promise<'ok' | 'missing' | 'full'> {
		const info = await this.info();
		if (!info) return 'missing';
		if (await this.isMember(id)) return 'ok';
		if (info.members >= MAX_GROUP_MEMBERS) return 'full';
		this.sql.exec('INSERT INTO member (id, joined_at) VALUES (?, ?)', id, now);
		return 'ok';
	}

	/** Takes a member out, with any room they showed. The owner can't leave: they delete it. */
	async leave(id: string): Promise<void> {
		this.sql.exec('DELETE FROM member WHERE id = ? AND id != (SELECT owner FROM info)', id);
		this.sql.exec('DELETE FROM room WHERE storyteller = ?', id);
	}

	/** Members' ids, the owner first, then oldest first. */
	async members(): Promise<string[]> {
		return this.sql
			.exec<{ id: string }>(
				'SELECT id FROM member ORDER BY id = (SELECT owner FROM info) DESC, joined_at, id'
			)
			.toArray()
			.map((row) => row.id);
	}

	/** Shows or hides a member's live room in the group; false when they aren't a member. */
	async showRoom(
		storyteller: string,
		room: string,
		show: boolean,
		title: string,
		now: number
	): Promise<boolean> {
		if (!(await this.isMember(storyteller))) return false;
		if (!show) {
			this.sql.exec('DELETE FROM room WHERE room = ? AND storyteller = ?', room, storyteller);
			return true;
		}
		this.sql.exec(
			'INSERT OR REPLACE INTO room (room, storyteller, title, at) VALUES (?, ?, ?, ?)',
			room,
			storyteller,
			title,
			now
		);
		return true;
	}

	/** Rooms shown in the last evening, newest first; older ones are dropped. */
	async rooms(now: number): Promise<GroupRoom[]> {
		this.sql.exec('DELETE FROM room WHERE at < ?', now - GROUP_GAME_TTL_MS);
		return this.sql
			.exec<{ room: string; storyteller: string; title: string; at: number }>(
				'SELECT room, storyteller, title, at FROM room ORDER BY at DESC'
			)
			.toArray()
			.map(({ room, storyteller, title, at }) => ({ room, storyteller, title, at }));
	}

	/** The owner deletes the group: returns its members, so each can forget it. */
	async erase(): Promise<string[]> {
		const ids = await this.members();
		await this.ctx.storage.deleteAll();
		return ids;
	}
}
