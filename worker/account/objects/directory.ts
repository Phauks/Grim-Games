import { DurableObject } from 'cloudflare:workers';

/**
 * Every account's id, for the admins' Accounts list (plan S27, Trevor 2026-10-30: "accounts
 * should allow seeing all accounts"). Durable Objects can't be listed, so each account adds
 * itself when it is made or next signs in (`AccountUser`) and leaves when it is deleted. Only
 * ids: each account says what it holds when an admin asks, so the list is never out of date.
 */
export class AccountDirectory extends DurableObject {
	async add(userId: string): Promise<void> {
		await this.ctx.storage.put(`user:${userId}`, Date.now());
	}

	async remove(userId: string): Promise<void> {
		await this.ctx.storage.delete(`user:${userId}`);
	}

	async ids(): Promise<string[]> {
		const users = await this.ctx.storage.list<number>({ prefix: 'user:' });
		return [...users.keys()].map((key) => key.slice('user:'.length));
	}
}
