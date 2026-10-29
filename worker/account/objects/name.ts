import { DurableObject } from 'cloudflare:workers';
import type { AccountEnv } from '../objects.ts';

/** One username: which user holds it. Unclaimed names keep no storage. */
export class AccountName extends DurableObject<AccountEnv> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: AccountEnv) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS owner (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				user_id TEXT NOT NULL
			);
		`);
	}

	/** Gives the name to `userId` unless someone else holds it. */
	async claim(userId: string): Promise<boolean> {
		const owner = this.sql
			.exec<{ user_id: string }>('SELECT user_id FROM owner WHERE id = 1')
			.toArray()[0]?.user_id;
		if (owner && owner !== userId) return false;
		this.sql.exec('INSERT OR REPLACE INTO owner (id, user_id) VALUES (1, ?)', userId);
		return true;
	}

	/** Who holds the name, if anyone (friend requests by username, worker/friends/). */
	async holder(): Promise<string | undefined> {
		return this.sql.exec<{ user_id: string }>('SELECT user_id FROM owner WHERE id = 1').toArray()[0]
			?.user_id;
	}

	/** Frees the name if `userId` holds it. */
	async release(userId: string): Promise<void> {
		this.sql.exec('DELETE FROM owner WHERE user_id = ?', userId);
		if (!this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM owner').one().n) {
			await this.ctx.storage.deleteAll();
		}
	}
}
