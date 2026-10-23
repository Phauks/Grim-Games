import { DurableObject } from 'cloudflare:workers';
import {
	CODE_TTL_MS,
	MAX_CODE_ATTEMPTS,
	MAX_CODES_PER_HOUR,
	MAX_PASSWORD_FAILURES,
	PRIVACY_VERSION
} from '../../../src/lib/features/account/account-protocol.ts';
import { randomAccountId } from '../../../src/lib/features/account/account-id.ts';
import { randomCode, randomToken, sameHash, sha256 } from '../crypto.ts';
import { userStub, type AccountEnv } from '../objects.ts';
import { HOUR_MS } from './shared.ts';

export type StartResult =
	{ ok: true; code: string; token: string } | { ok: false; reason: 'rate-limited' };

export type VerifyResult =
	| { ok: true; userId: string; created: boolean }
	| { ok: false; reason: 'expired' | 'wrong' | 'too-many' }
	/** The code is right but the privacy policy must be accepted first; the code still works. */
	| { ok: false; reason: 'privacy'; creating: boolean };

export type ChangeStartResult = { ok: true; code: string } | { ok: false; reason: 'rate-limited' };

export type ChangeResult =
	{ ok: true } | { ok: false; reason: 'expired' | 'wrong' | 'too-many' | 'taken' };

type PendingRow = { code_hash: string; expires_at: number; attempts: number };

/** Checks a typed code against a pending row; `table` holds at most one row (id 1). */
async function checkCode(
	sql: SqlStorage,
	table: 'pending' | 'change_pending',
	row: PendingRow | undefined,
	code: string,
	now: number
): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'wrong' | 'too-many' }> {
	if (!row || row.expires_at < now) {
		sql.exec(`DELETE FROM ${table}`);
		return { ok: false, reason: 'expired' };
	}
	if (sameHash(await sha256(`code:${code}`), row.code_hash)) {
		sql.exec(`DELETE FROM ${table}`);
		return { ok: true };
	}
	const attempts = row.attempts + 1;
	if (attempts >= MAX_CODE_ATTEMPTS) {
		sql.exec(`DELETE FROM ${table}`);
		return { ok: false, reason: 'too-many' };
	}
	sql.exec(`UPDATE ${table} SET attempts = ? WHERE id = 1`, attempts);
	return { ok: false, reason: 'wrong' };
}

export class AccountEmail extends DurableObject<AccountEnv> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: AccountEnv) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.createTables();
	}

	private createTables(): void {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS pending (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				code_hash TEXT NOT NULL,
				token_hash TEXT NOT NULL,
				expires_at INTEGER NOT NULL,
				attempts INTEGER NOT NULL DEFAULT 0
			);
			CREATE TABLE IF NOT EXISTS sent (at INTEGER NOT NULL);
			CREATE TABLE IF NOT EXISTS owner (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				user_id TEXT NOT NULL
			);
			-- Wrong passwords for this address, for the hourly limit.
			CREATE TABLE IF NOT EXISTS failed (at INTEGER NOT NULL);
			-- A signed-in user moving their account to this address: the code sent here.
			CREATE TABLE IF NOT EXISTS change_pending (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				user_id TEXT NOT NULL,
				code_hash TEXT NOT NULL,
				expires_at INTEGER NOT NULL,
				attempts INTEGER NOT NULL DEFAULT 0
			);
		`);
	}

	/** Counts a code sent to this address; false once the hourly limit is reached. */
	private countSend(now: number): boolean {
		this.sql.exec('DELETE FROM sent WHERE at < ?', now - HOUR_MS);
		const sent = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM sent').one().n;
		if (sent >= MAX_CODES_PER_HOUR) return false;
		this.sql.exec('INSERT INTO sent (at) VALUES (?)', now);
		return true;
	}

	private owner(): string | undefined {
		return this.sql.exec<{ user_id: string }>('SELECT user_id FROM owner WHERE id = 1').toArray()[0]
			?.user_id;
	}

	/**
	 * Before a password is checked: the account this address belongs to, or `limited` once
	 * MAX_PASSWORD_FAILURES wrong passwords were tried in the last hour.
	 */
	async passwordOwner(now: number): Promise<{ limited: boolean; userId?: string }> {
		this.sql.exec('DELETE FROM failed WHERE at < ?', now - HOUR_MS);
		const failed = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM failed').one().n;
		return { limited: failed >= MAX_PASSWORD_FAILURES, userId: this.owner() };
	}

	/** Counts a wrong password (also for an address with no account, so both look the same). */
	async passwordFailed(now: number): Promise<void> {
		this.sql.exec('INSERT INTO failed (at) VALUES (?)', now);
		await this.ctx.storage.setAlarm(now + HOUR_MS);
	}

	/** Makes a new code and link token, replacing any earlier one. */
	async start(now: number): Promise<StartResult> {
		if (!this.countSend(now)) return { ok: false, reason: 'rate-limited' };
		const code = randomCode();
		const token = randomToken();
		this.sql.exec(
			'INSERT OR REPLACE INTO pending (id, code_hash, token_hash, expires_at, attempts) VALUES (1, ?, ?, ?, 0)',
			await sha256(`code:${code}`),
			await sha256(`token:${token}`),
			now + CODE_TTL_MS
		);
		// Clear stale rows later even if nobody signs in.
		await this.ctx.storage.setAlarm(now + HOUR_MS);
		return { ok: true, code, token };
	}

	/**
	 * Makes a code that moves `userId`'s account to this address. Whether the address is
	 * already taken is only said once the code is confirmed, so this can't be used to find
	 * out which addresses have accounts.
	 */
	async startChange(userId: string, now: number): Promise<ChangeStartResult> {
		if (!this.countSend(now)) return { ok: false, reason: 'rate-limited' };
		const code = randomCode();
		this.sql.exec(
			'INSERT OR REPLACE INTO change_pending (id, user_id, code_hash, expires_at, attempts) VALUES (1, ?, ?, ?, 0)',
			userId,
			await sha256(`code:${code}`),
			now + CODE_TTL_MS
		);
		await this.ctx.storage.setAlarm(now + HOUR_MS);
		return { ok: true, code };
	}

	/** Checks the code from `startChange`; on success this address now belongs to `userId`. */
	confirmChange(userId: string, code: string, now: number): Promise<ChangeResult> {
		return this.ctx.blockConcurrencyWhile(async () => {
			const row = this.sql
				.exec<PendingRow>(
					'SELECT code_hash, expires_at, attempts FROM change_pending WHERE id = 1 AND user_id = ?',
					userId
				)
				.toArray()[0];
			const checked = await checkCode(this.sql, 'change_pending', row, code, now);
			if (!checked.ok) return checked;
			const owner = this.owner();
			if (owner && owner !== userId) return { ok: false, reason: 'taken' };
			this.sql.exec('INSERT OR REPLACE INTO owner (id, user_id) VALUES (1, ?)', userId);
			return { ok: true };
		});
	}

	/** Checks a code or link token; on success returns the user, making one on first sign-in. */
	verify(
		email: string,
		proof: { code: string } | { token: string },
		now: number,
		/** The privacy policy version the user accepted on this request, if any. */
		accepted?: string
	): Promise<VerifyResult> {
		// One at a time, so two devices finishing at once can't make two users.
		return this.ctx.blockConcurrencyWhile(() => this.check(email, proof, now, accepted));
	}

	private async check(
		email: string,
		proof: { code: string } | { token: string },
		now: number,
		accepted?: string
	): Promise<VerifyResult> {
		const row = this.sql
			.exec<{ code_hash: string; token_hash: string; expires_at: number; attempts: number }>(
				'SELECT code_hash, token_hash, expires_at, attempts FROM pending WHERE id = 1'
			)
			.toArray()[0];
		if (!row || row.expires_at < now) {
			this.sql.exec('DELETE FROM pending');
			return { ok: false, reason: 'expired' };
		}
		const matches =
			'code' in proof
				? sameHash(await sha256(`code:${proof.code}`), row.code_hash)
				: sameHash(await sha256(`token:${proof.token}`), row.token_hash);
		if (!matches) {
			const attempts = row.attempts + 1;
			if (attempts >= MAX_CODE_ATTEMPTS) {
				this.sql.exec('DELETE FROM pending');
				return { ok: false, reason: 'too-many' };
			}
			this.sql.exec('UPDATE pending SET attempts = ? WHERE id = 1', attempts);
			return { ok: false, reason: 'wrong' };
		}
		const owner = this.owner();
		// Asked before the code is used up, so the same code works once the policy is accepted.
		if (accepted !== PRIVACY_VERSION) {
			if (!owner) return { ok: false, reason: 'privacy', creating: true };
			if ((await userStub(this.env, owner).privacyVersion()) !== PRIVACY_VERSION) {
				return { ok: false, reason: 'privacy', creating: false };
			}
		}
		this.sql.exec('DELETE FROM pending');

		if (owner) {
			if (accepted === PRIVACY_VERSION)
				await userStub(this.env, owner).acceptPrivacy(accepted, now);
			return { ok: true, userId: owner, created: false };
		}
		// A new id, picked again in the rare case it is already some account's.
		let userId = randomAccountId();
		while (!(await userStub(this.env, userId).init(userId, email, now, PRIVACY_VERSION))) {
			userId = randomAccountId();
		}
		this.sql.exec('INSERT INTO owner (id, user_id) VALUES (1, ?)', userId);
		return { ok: true, userId, created: true };
	}

	/** The user this address belongs to, if anyone has signed in with it. */
	async ownerId(): Promise<string | undefined> {
		return this.owner();
	}

	/** Called when the account is deleted: the address no longer belongs to anyone. */
	async forget(userId: string): Promise<void> {
		const owner = this.owner();
		if (!owner || owner === userId) await this.clear();
	}

	/** Deletes everything; the empty tables come back so later calls on this instance work. */
	private async clear(): Promise<void> {
		await this.ctx.storage.deleteAll();
		this.createTables();
	}

	async alarm(): Promise<void> {
		const now = Date.now();
		this.sql.exec('DELETE FROM sent WHERE at < ?', now - HOUR_MS);
		this.sql.exec('DELETE FROM pending WHERE expires_at < ?', now);
		this.sql.exec('DELETE FROM change_pending WHERE expires_at < ?', now);
		this.sql.exec('DELETE FROM failed WHERE at < ?', now - HOUR_MS);
		const owned = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM owner').one().n;
		const left =
			this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM sent').one().n +
			this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM failed').one().n;
		const pending =
			this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM pending').one().n +
			this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM change_pending').one().n;
		// An address that never finished signing in leaves nothing behind.
		if (!owned && !left && !pending) await this.clear();
		else if (left || pending) await this.ctx.storage.setAlarm(now + HOUR_MS);
	}
}
