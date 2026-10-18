/**
 * Account storage: SQLite-backed Durable Objects (07-accounts-and-multi-device.md §2.1).
 *
 * - `AccountEmail`, one per email address (`idFromName(email)`): the pending sign-in code
 *   and which user the address belongs to. Kept apart from the user so Discord or Google
 *   sign-in can point at the same user later.
 * - `AccountUser`, one per user (`userStub(id)`): the profile, signed-in sessions and the
 *   profile's documents (saved scripts now, saved games later).
 * - `AccountName`, one per username (`idFromName(usernameKey(name))`): which user holds it.
 *
 * The user's random id is the account: everything is stored under it, and the email and
 * username are only pointers to it, so both can change without moving anything.
 *
 * Secrets (codes, link tokens, session tokens) are stored only as SHA-256 hashes.
 */
import { DurableObject } from 'cloudflare:workers';
import {
	CODE_TTL_MS,
	MAX_CODE_ATTEMPTS,
	MAX_CODES_PER_HOUR,
	MAX_DOC_BYTES,
	MAX_DOCS_PER_KIND,
	SESSION_IDLE_MS,
	type AccountUser as User,
	type DeviceSession,
	type DocKind,
	type ProfileDoc
} from '../../src/lib/features/account/account-protocol.ts';
import { isLegacyAccountId, randomAccountId } from '../../src/lib/features/account/account-id.ts';
import { randomCode, randomToken, sameHash, sha256 } from './crypto.ts';

export interface AccountEnv {
	ACCOUNT_USERS: DurableObjectNamespace<AccountUser>;
	ACCOUNT_EMAILS: DurableObjectNamespace<AccountEmail>;
	ACCOUNT_NAMES: DurableObjectNamespace<AccountName>;
}

/**
 * The Durable Object of an account. New accounts are named by their word-chain id; accounts
 * made before those keep the hex id of a `newUniqueId()` object, which stays valid.
 */
export function userStub(env: AccountEnv, userId: string): DurableObjectStub<AccountUser> {
	const users = env.ACCOUNT_USERS;
	return users.get(
		isLegacyAccountId(userId) ? users.idFromString(userId) : users.idFromName(userId)
	);
}

const HOUR_MS = 60 * 60 * 1000;
/** `last_seen_at` is written at most this often, so reads don't each cost a write. */
const SEEN_GRANULARITY_MS = HOUR_MS;

export type StartResult =
	{ ok: true; code: string; token: string } | { ok: false; reason: 'rate-limited' };

export type VerifyResult =
	| { ok: true; userId: string; created: boolean }
	| { ok: false; reason: 'expired' | 'wrong' | 'too-many' };

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
		now: number
	): Promise<VerifyResult> {
		// One at a time, so two devices finishing at once can't make two users.
		return this.ctx.blockConcurrencyWhile(() => this.check(email, proof, now));
	}

	private async check(
		email: string,
		proof: { code: string } | { token: string },
		now: number
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
		this.sql.exec('DELETE FROM pending');

		const owner = this.owner();
		if (owner) return { ok: true, userId: owner, created: false };
		// A new id, picked again in the rare case it is already some account's.
		let userId = randomAccountId();
		while (!(await userStub(this.env, userId).init(userId, email, now))) userId = randomAccountId();
		this.sql.exec('INSERT INTO owner (id, user_id) VALUES (1, ?)', userId);
		return { ok: true, userId, created: true };
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
		const owned = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM owner').one().n;
		const left = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM sent').one().n;
		const pending =
			this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM pending').one().n +
			this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM change_pending').one().n;
		// An address that never finished signing in leaves nothing behind.
		if (!owned && !left && !pending) await this.clear();
		else if (left || pending) await this.ctx.storage.setAlarm(now + HOUR_MS);
	}
}

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

	/** Frees the name if `userId` holds it. */
	async release(userId: string): Promise<void> {
		this.sql.exec('DELETE FROM owner WHERE user_id = ?', userId);
		if (!this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM owner').one().n) {
			await this.ctx.storage.deleteAll();
		}
	}
}

interface DocRow extends Record<string, SqlStorageValue> {
	kind: string;
	id: string;
	rev: number;
	updated_at: number;
	deleted: number;
	body: string | null;
}

function toDoc(row: DocRow): ProfileDoc {
	return {
		id: row.id,
		kind: row.kind as DocKind,
		rev: row.rev,
		updatedAt: row.updated_at,
		deleted: row.deleted === 1,
		...(row.body === null ? {} : { body: JSON.parse(row.body) as unknown })
	};
}

export type PutResult =
	| { ok: true; doc: ProfileDoc }
	| { ok: false; reason: 'conflict'; doc: ProfileDoc }
	| { ok: false; reason: 'too-large' | 'too-many' };

export type Authenticated = { user: User; sessionId: string };

export class AccountUser extends DurableObject<AccountEnv> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: AccountEnv) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.createTables();
	}

	private createTables(): void {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS profile (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				email TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS session (
				id TEXT PRIMARY KEY,
				token_hash TEXT NOT NULL UNIQUE,
				device TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				last_seen_at INTEGER NOT NULL
			);
			-- The word-chain account id. Older accounts have no row: their id is this object's.
			CREATE TABLE IF NOT EXISTS account (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				account_id TEXT NOT NULL
			);
			-- Its own table, so accounts made before usernames need no change to the profile table.
			CREATE TABLE IF NOT EXISTS username (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				name TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS doc (
				kind TEXT NOT NULL,
				id TEXT NOT NULL,
				rev INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				deleted INTEGER NOT NULL DEFAULT 0,
				body TEXT,
				PRIMARY KEY (kind, id)
			);
		`);
	}

	private user(): User | undefined {
		const row = this.sql
			.exec<{ email: string; created_at: number; username: string | null }>(
				`SELECT email, created_at, (SELECT name FROM username WHERE id = 1) AS username
				 FROM profile WHERE id = 1`
			)
			.toArray()[0];
		return (
			row && {
				id: this.accountId(),
				email: row.email,
				username: row.username,
				createdAt: row.created_at
			}
		);
	}

	/** After the new address was confirmed (`AccountEmail.confirmChange`). Returns the old one. */
	async setEmail(email: string): Promise<{ old: string | undefined; user: User | undefined }> {
		const old = this.user()?.email;
		this.sql.exec('UPDATE profile SET email = ? WHERE id = 1', email);
		return { old, user: this.user() };
	}

	/** After the name was claimed (`AccountName.claim`). Returns the old name. */
	async setUsername(name: string): Promise<{ old: string | null; user: User | undefined }> {
		const old = this.user()?.username ?? null;
		this.sql.exec('INSERT OR REPLACE INTO username (id, name) VALUES (1, ?)', name);
		return { old, user: this.user() };
	}

	private accountId(): string {
		return (
			this.sql
				.exec<{ account_id: string }>('SELECT account_id FROM account WHERE id = 1')
				.toArray()[0]?.account_id ?? this.ctx.id.toString()
		);
	}

	/** Makes the account. False when this id already belongs to one (the caller picks another). */
	async init(accountId: string, email: string, now: number): Promise<boolean> {
		if (this.user()) return false;
		this.sql.exec('INSERT INTO account (id, account_id) VALUES (1, ?)', accountId);
		this.sql.exec('INSERT INTO profile (id, email, created_at) VALUES (1, ?, ?)', email, now);
		return true;
	}

	/** Starts a session; the cookie value is `<user id>.<secret>`. */
	async createSession(device: string, now: number): Promise<string> {
		const secret = randomToken();
		this.sql.exec(
			'INSERT INTO session (id, token_hash, device, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
			randomToken(9),
			await sha256(`session:${secret}`),
			device.slice(0, 60),
			now,
			now
		);
		return `${this.accountId()}.${secret}`;
	}

	/** The signed-in user for a session secret, or undefined when it isn't (or no longer) valid. */
	async authenticate(secret: string, now: number): Promise<Authenticated | undefined> {
		const user = this.user();
		if (!user) return undefined;
		this.sql.exec('DELETE FROM session WHERE last_seen_at < ?', now - SESSION_IDLE_MS);
		const hash = await sha256(`session:${secret}`);
		const row = this.sql
			.exec<{ id: string; last_seen_at: number }>(
				'SELECT id, last_seen_at FROM session WHERE token_hash = ?',
				hash
			)
			.toArray()[0];
		if (!row) return undefined;
		if (now - row.last_seen_at > SEEN_GRANULARITY_MS) {
			this.sql.exec('UPDATE session SET last_seen_at = ? WHERE id = ?', now, row.id);
		}
		return { user, sessionId: row.id };
	}

	async sessions(currentId: string): Promise<DeviceSession[]> {
		return this.sql
			.exec<{ id: string; device: string; created_at: number; last_seen_at: number }>(
				'SELECT id, device, created_at, last_seen_at FROM session ORDER BY last_seen_at DESC'
			)
			.toArray()
			.map((row) => ({
				id: row.id,
				device: row.device,
				createdAt: row.created_at,
				lastSeenAt: row.last_seen_at,
				current: row.id === currentId
			}));
	}

	async endSession(id: string): Promise<void> {
		this.sql.exec('DELETE FROM session WHERE id = ?', id);
	}

	async endOtherSessions(keepId: string): Promise<void> {
		this.sql.exec('DELETE FROM session WHERE id != ?', keepId);
	}

	async listDocs(kind: DocKind): Promise<ProfileDoc[]> {
		return this.sql
			.exec<DocRow>(
				'SELECT kind, id, rev, updated_at, deleted, body FROM doc WHERE kind = ? ORDER BY updated_at DESC',
				kind
			)
			.toArray()
			.map(toDoc);
	}

	/**
	 * Saves a document if `baseRev` is the stored revision (0 for a new one), else returns the
	 * stored copy so the device can resolve the conflict (07 §3). Deleting keeps a tombstone
	 * so other devices learn about it.
	 */
	async putDoc(
		kind: DocKind,
		id: string,
		baseRev: number,
		body: unknown,
		deleted: boolean,
		now: number
	): Promise<PutResult> {
		const text = deleted ? null : JSON.stringify(body ?? null);
		if (text && text.length > MAX_DOC_BYTES) return { ok: false, reason: 'too-large' };
		const existing = this.sql
			.exec<DocRow>(
				'SELECT kind, id, rev, updated_at, deleted, body FROM doc WHERE kind = ? AND id = ?',
				kind,
				id
			)
			.toArray()[0];
		const storedRev = existing?.rev ?? 0;
		if (baseRev !== storedRev) {
			if (existing) return { ok: false, reason: 'conflict', doc: toDoc(existing) };
			return {
				ok: false,
				reason: 'conflict',
				doc: { id, kind, rev: 0, updatedAt: 0, deleted: true }
			};
		}
		if (!existing) {
			const count = this.sql
				.exec<{ n: number }>('SELECT COUNT(*) AS n FROM doc WHERE kind = ? AND deleted = 0', kind)
				.one().n;
			if (count >= MAX_DOCS_PER_KIND) return { ok: false, reason: 'too-many' };
		}
		const rev = storedRev + 1;
		this.sql.exec(
			`INSERT INTO doc (kind, id, rev, updated_at, deleted, body) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (kind, id) DO UPDATE SET rev = excluded.rev, updated_at = excluded.updated_at,
			   deleted = excluded.deleted, body = excluded.body`,
			kind,
			id,
			rev,
			now,
			deleted ? 1 : 0,
			text
		);
		return {
			ok: true,
			doc: {
				id,
				kind,
				rev,
				updatedAt: now,
				deleted,
				...(text === null ? {} : { body: JSON.parse(text) as unknown })
			}
		};
	}

	/** Everything stored for this user, for "Download my data". */
	async exportAll(): Promise<{
		user: User | undefined;
		sessions: Omit<DeviceSession, 'current'>[];
		docs: ProfileDoc[];
	}> {
		return {
			user: this.user(),
			sessions: (await this.sessions('')).map(({ id, device, createdAt, lastSeenAt }) => ({
				id,
				device,
				createdAt,
				lastSeenAt
			})),
			docs: this.sql
				.exec<DocRow>(
					'SELECT kind, id, rev, updated_at, deleted, body FROM doc WHERE deleted = 0 ORDER BY kind, updated_at DESC'
				)
				.toArray()
				.map(toDoc)
		};
	}

	/** Deletes the user and everything stored for them. Returns the email and name to release. */
	async deleteAccount(): Promise<{ email?: string; username?: string }> {
		const user = this.user();
		await this.ctx.storage.deleteAll();
		this.createTables();
		return { email: user?.email, username: user?.username ?? undefined };
	}
}
