/**
 * Account storage: SQLite-backed Durable Objects (07-accounts-and-multi-device.md §2.1).
 *
 * - `AccountEmail`, one per email address (`idFromName(email)`): the pending sign-in code
 *   and which user the address belongs to. Kept apart from the user so Discord or Google
 *   sign-in can point at the same user later.
 * - `AccountUser`, one per user (`newUniqueId()`): the profile, signed-in sessions and the
 *   profile's documents (saved scripts now, saved games later).
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
import { randomCode, randomToken, sameHash, sha256 } from './crypto.ts';

export interface AccountEnv {
	ACCOUNT_USERS: DurableObjectNamespace<AccountUser>;
	ACCOUNT_EMAILS: DurableObjectNamespace<AccountEmail>;
}

const HOUR_MS = 60 * 60 * 1000;
/** `last_seen_at` is written at most this often, so reads don't each cost a write. */
const SEEN_GRANULARITY_MS = HOUR_MS;

export type StartResult =
	{ ok: true; code: string; token: string } | { ok: false; reason: 'rate-limited' };

export type VerifyResult =
	| { ok: true; userId: string; created: boolean }
	| { ok: false; reason: 'expired' | 'wrong' | 'too-many' };

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
		`);
	}

	/** Makes a new code and link token, replacing any earlier one. */
	async start(now: number): Promise<StartResult> {
		this.sql.exec('DELETE FROM sent WHERE at < ?', now - HOUR_MS);
		const sent = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM sent').one().n;
		if (sent >= MAX_CODES_PER_HOUR) return { ok: false, reason: 'rate-limited' };
		const code = randomCode();
		const token = randomToken();
		this.sql.exec(
			'INSERT OR REPLACE INTO pending (id, code_hash, token_hash, expires_at, attempts) VALUES (1, ?, ?, ?, 0)',
			await sha256(`code:${code}`),
			await sha256(`token:${token}`),
			now + CODE_TTL_MS
		);
		this.sql.exec('INSERT INTO sent (at) VALUES (?)', now);
		// Clear stale rows later even if nobody signs in.
		await this.ctx.storage.setAlarm(now + HOUR_MS);
		return { ok: true, code, token };
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

		const owner = this.sql
			.exec<{ user_id: string }>('SELECT user_id FROM owner WHERE id = 1')
			.toArray()[0];
		if (owner) return { ok: true, userId: owner.user_id, created: false };
		const userId = this.env.ACCOUNT_USERS.newUniqueId().toString();
		await this.env.ACCOUNT_USERS.get(this.env.ACCOUNT_USERS.idFromString(userId)).init(email, now);
		this.sql.exec('INSERT INTO owner (id, user_id) VALUES (1, ?)', userId);
		return { ok: true, userId, created: true };
	}

	/** The user this address belongs to, if anyone has signed in with it. */
	async ownerId(): Promise<string | undefined> {
		return this.sql.exec<{ user_id: string }>('SELECT user_id FROM owner WHERE id = 1').toArray()[0]
			?.user_id;
	}

	/** Called when the account is deleted: the address no longer belongs to anyone. */
	async forget(userId: string): Promise<void> {
		const owner = this.sql
			.exec<{ user_id: string }>('SELECT user_id FROM owner WHERE id = 1')
			.toArray()[0];
		if (!owner || owner.user_id === userId) await this.clear();
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
		const owned = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM owner').one().n;
		const left = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM sent').one().n;
		const pending = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM pending').one().n;
		// An address that never finished signing in leaves nothing behind.
		if (!owned && !left && !pending) await this.clear();
		else if (left || pending) await this.ctx.storage.setAlarm(now + HOUR_MS);
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
			.exec<{ email: string; created_at: number }>(
				'SELECT email, created_at FROM profile WHERE id = 1'
			)
			.toArray()[0];
		return row && { id: this.ctx.id.toString(), email: row.email, createdAt: row.created_at };
	}

	async init(email: string, now: number): Promise<void> {
		this.sql.exec(
			'INSERT OR IGNORE INTO profile (id, email, created_at) VALUES (1, ?, ?)',
			email,
			now
		);
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
		return `${this.ctx.id.toString()}.${secret}`;
	}

	/** The profile, or undefined once the account is deleted. */
	async profile(): Promise<User | undefined> {
		return this.user();
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

	/** Deletes the user and everything stored for them. Returns the email to release. */
	async deleteAccount(): Promise<string | undefined> {
		const email = this.user()?.email;
		await this.ctx.storage.deleteAll();
		this.createTables();
		return email;
	}
}
