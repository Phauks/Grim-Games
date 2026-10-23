import { DurableObject } from 'cloudflare:workers';
import {
	MAX_DOC_BYTES,
	MAX_DOCS_PER_KIND,
	SESSION_IDLE_MS,
	SHORT_SESSION_IDLE_MS,
	type AccountUser as User,
	MAX_SYNC_BYTES,
	type DevicePlace,
	type DeviceSession,
	type DocKind,
	type ProfileDoc,
	type SyncRequest,
	type SyncResponse,
	type SyncResult
} from '../../../src/lib/features/account/account-protocol.ts';
import { passwordHash, randomToken, sameHash, sha256 } from '../crypto.ts';
import type { AccountEnv } from '../objects.ts';
import { HOUR_MS, type PasswordHash } from './shared.ts';

/** `last_seen_at` is written at most this often, so reads don't each cost a write. */
const SEEN_GRANULARITY_MS = HOUR_MS;

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

/** `remember` is false for a session made without "Remember me". */
export type Authenticated = { user: User; sessionId: string; remember: boolean };

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
			-- Sessions made without "Remember me": they end after a shorter time unused.
			CREATE TABLE IF NOT EXISTS short_session (id TEXT PRIMARY KEY);
			-- Where each session was last used, roughly (Cloudflare's city and country; no IP).
			CREATE TABLE IF NOT EXISTS session_place (
				id TEXT PRIMARY KEY,
				city TEXT,
				country TEXT
			);
			-- The password's PBKDF2-SHA256 hash and salt; no row means sign-in by emailed code only.
			CREATE TABLE IF NOT EXISTS password (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				hash TEXT NOT NULL,
				salt TEXT NOT NULL,
				iterations INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			-- Its own table, so accounts made before usernames need no change to the profile table.
			CREATE TABLE IF NOT EXISTS username (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				name TEXT NOT NULL
			);
			-- Which privacy policy version the user accepted, and when (Trevor, 2026-10-18).
			CREATE TABLE IF NOT EXISTS privacy (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				version TEXT NOT NULL,
				accepted_at INTEGER NOT NULL
			);
			-- The profile icon: an official character's id (Trevor, 2026-10-18), never an image.
			CREATE TABLE IF NOT EXISTS icon (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				character_id TEXT NOT NULL
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
			-- The account's change counter: a device asks for documents changed after a value.
			CREATE TABLE IF NOT EXISTS sync_counter (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				value INTEGER NOT NULL
			);
			INSERT OR IGNORE INTO sync_counter (id, value) VALUES (1, 1);
			-- The counter's value when each document last changed.
			CREATE TABLE IF NOT EXISTS doc_seq (
				kind TEXT NOT NULL,
				id TEXT NOT NULL,
				seq INTEGER NOT NULL,
				PRIMARY KEY (kind, id)
			);
			CREATE INDEX IF NOT EXISTS doc_seq_by_seq ON doc_seq (seq);
			-- Documents saved before the counter existed count as changed at 1.
			INSERT OR IGNORE INTO doc_seq (kind, id, seq) SELECT kind, id, 1 FROM doc;
		`);
	}

	private user(): User | undefined {
		const row = this.sql
			.exec<{
				email: string;
				created_at: number;
				username: string | null;
				icon: string | null;
				has_password: number;
			}>(
				`SELECT email, created_at, (SELECT name FROM username WHERE id = 1) AS username,
				   (SELECT character_id FROM icon WHERE id = 1) AS icon,
				   EXISTS (SELECT 1 FROM password) AS has_password
				 FROM profile WHERE id = 1`
			)
			.toArray()[0];
		return (
			row && {
				id: this.accountId(),
				email: row.email,
				username: row.username,
				icon: row.icon,
				hasPassword: row.has_password === 1,
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

	/** Sets the profile icon (a character id), or clears it with null. */
	async setIcon(characterId: string | null): Promise<User | undefined> {
		if (characterId === null) this.sql.exec('DELETE FROM icon');
		else {
			this.sql.exec('INSERT OR REPLACE INTO icon (id, character_id) VALUES (1, ?)', characterId);
		}
		return this.user();
	}

	/** After the name was claimed (`AccountName.claim`). Returns the old name. */
	async setUsername(name: string): Promise<{ old: string | null; user: User | undefined }> {
		const old = this.user()?.username ?? null;
		this.sql.exec('INSERT OR REPLACE INTO username (id, name) VALUES (1, ?)', name);
		return { old, user: this.user() };
	}

	/** Sets or replaces the password from its hash (`hashPassword`). */
	async setPasswordHash(password: PasswordHash, now: number): Promise<User | undefined> {
		this.sql.exec(
			'INSERT OR REPLACE INTO password (id, hash, salt, iterations, updated_at) VALUES (1, ?, ?, ?, ?)',
			password.hash,
			password.salt,
			password.iterations,
			now
		);
		return this.user();
	}

	/** Whether `password` is this account's. False when it has none. */
	async checkPassword(password: string): Promise<boolean> {
		const row = this.sql
			.exec<{ hash: string; salt: string; iterations: number }>(
				'SELECT hash, salt, iterations FROM password WHERE id = 1'
			)
			.toArray()[0];
		if (!row) return false;
		return sameHash(await passwordHash(password, row.salt, row.iterations), row.hash);
	}

	private accountId(): string {
		return (
			this.sql
				.exec<{ account_id: string }>('SELECT account_id FROM account WHERE id = 1')
				.toArray()[0]?.account_id ?? this.ctx.id.toString()
		);
	}

	/**
	 * Makes the account, with the privacy policy version accepted to make it. False when this
	 * id already belongs to one (the caller picks another).
	 */
	async init(accountId: string, email: string, now: number, privacy: string): Promise<boolean> {
		if (this.user()) return false;
		this.sql.exec('INSERT INTO account (id, account_id) VALUES (1, ?)', accountId);
		this.sql.exec('INSERT INTO profile (id, email, created_at) VALUES (1, ?, ?)', email, now);
		await this.acceptPrivacy(privacy, now);
		return true;
	}

	/** The privacy policy version this user last accepted; undefined for older accounts. */
	async privacyVersion(): Promise<string | undefined> {
		return this.privacy()?.version;
	}

	async acceptPrivacy(version: string, now: number): Promise<void> {
		this.sql.exec(
			`INSERT INTO privacy (id, version, accepted_at) VALUES (1, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET version = excluded.version, accepted_at = excluded.accepted_at`,
			version,
			now
		);
	}

	private privacy(): { version: string; acceptedAt: number } | undefined {
		const row = this.sql
			.exec<{ version: string; accepted_at: number }>(
				'SELECT version, accepted_at FROM privacy WHERE id = 1'
			)
			.toArray()[0];
		return row && { version: row.version, acceptedAt: row.accepted_at };
	}

	/**
	 * Starts a session; the cookie value is `<user id>.<secret>`. Without `remember` it ends
	 * after SHORT_SESSION_IDLE_MS unused (and its cookie when the browser closes).
	 */
	async createSession(
		device: string,
		now: number,
		remember = true,
		place?: DevicePlace
	): Promise<string> {
		const secret = randomToken();
		const id = randomToken(9);
		this.sql.exec(
			'INSERT INTO session (id, token_hash, device, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
			id,
			await sha256(`session:${secret}`),
			device.slice(0, 60),
			now,
			now
		);
		if (!remember) this.sql.exec('INSERT INTO short_session (id) VALUES (?)', id);
		if (place) this.setPlace(id, place);
		return `${this.accountId()}.${secret}`;
	}

	/** The profile, or undefined once the account is deleted. */
	async profile(): Promise<User | undefined> {
		return this.user();
	}

	/** The signed-in user for a session secret, or undefined when it isn't (or no longer) valid. */
	async authenticate(
		secret: string,
		now: number,
		place?: DevicePlace
	): Promise<Authenticated | undefined> {
		const user = this.user();
		if (!user) return undefined;
		this.sql.exec('DELETE FROM session WHERE last_seen_at < ?', now - SESSION_IDLE_MS);
		this.sql.exec(
			'DELETE FROM session WHERE last_seen_at < ? AND id IN (SELECT id FROM short_session)',
			now - SHORT_SESSION_IDLE_MS
		);
		this.sql.exec('DELETE FROM short_session WHERE id NOT IN (SELECT id FROM session)');
		this.sql.exec('DELETE FROM session_place WHERE id NOT IN (SELECT id FROM session)');
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
			if (place) this.setPlace(row.id, place);
		}
		const short = this.sql
			.exec<{ n: number }>('SELECT COUNT(*) AS n FROM short_session WHERE id = ?', row.id)
			.one().n;
		return { user, sessionId: row.id, remember: short === 0 };
	}

	private setPlace(id: string, { city, country }: DevicePlace): void {
		this.sql.exec(
			'INSERT OR REPLACE INTO session_place (id, city, country) VALUES (?, ?, ?)',
			id,
			city ?? null,
			country ?? null
		);
	}

	async sessions(currentId: string): Promise<DeviceSession[]> {
		return this.sql
			.exec<{
				id: string;
				device: string;
				created_at: number;
				last_seen_at: number;
				city: string | null;
				country: string | null;
			}>(
				`SELECT s.id, s.device, s.created_at, s.last_seen_at, p.city, p.country
				FROM session s LEFT JOIN session_place p ON p.id = s.id ORDER BY s.last_seen_at DESC`
			)
			.toArray()
			.map((row) => ({
				id: row.id,
				device: row.device,
				createdAt: row.created_at,
				lastSeenAt: row.last_seen_at,
				current: row.id === currentId,
				...(row.city ? { city: row.city } : {}),
				...(row.country ? { country: row.country } : {})
			}));
	}

	async endSession(id: string): Promise<void> {
		this.sql.exec('DELETE FROM session WHERE id = ?', id);
	}

	async endOtherSessions(keepId: string): Promise<void> {
		this.sql.exec('DELETE FROM session WHERE id != ?', keepId);
	}

	async endAllSessions(): Promise<void> {
		this.sql.exec('DELETE FROM session');
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
		const seq = this.sql
			.exec<{ value: number }>(
				'UPDATE sync_counter SET value = value + 1 WHERE id = 1 RETURNING value'
			)
			.one().value;
		this.sql.exec('INSERT OR REPLACE INTO doc_seq (kind, id, seq) VALUES (?, ?, ?)', kind, id, seq);
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

	/**
	 * Applies a device's queued changes in order (each as `putDoc`), then returns the
	 * documents of `kinds` changed after `since`, oldest first, up to about MAX_SYNC_BYTES.
	 */
	async sync(request: SyncRequest, now: number): Promise<SyncResponse> {
		const results: SyncResult[] = [];
		for (const change of request.changes) {
			const { kind, id } = change;
			const result = await this.putDoc(
				kind,
				id,
				change.baseRev,
				change.body,
				change.deleted === true,
				now
			);
			results.push(
				result.ok
					? { kind, id, status: 'saved', doc: result.doc }
					: result.reason === 'conflict'
						? { kind, id, status: 'conflict', doc: result.doc }
						: { kind, id, status: result.reason }
			);
		}
		const changes: ProfileDoc[] = [];
		let cursor = request.since;
		let more = false;
		if (request.kinds.length > 0) {
			const rows = this.sql.exec<DocRow & { seq: number }>(
				`SELECT d.kind, d.id, d.rev, d.updated_at, d.deleted, d.body, s.seq
				FROM doc_seq s JOIN doc d ON d.kind = s.kind AND d.id = s.id
				WHERE s.seq > ? AND s.kind IN (${request.kinds.map(() => '?').join(', ')})
				ORDER BY s.seq`,
				request.since,
				...request.kinds
			);
			let bytes = 0;
			for (const row of rows) {
				bytes += (row.body?.length ?? 0) + 200;
				// Always at least one, so a single large document still gets through.
				if (changes.length > 0 && bytes > MAX_SYNC_BYTES) {
					more = true;
					break;
				}
				changes.push(toDoc(row));
				cursor = row.seq;
			}
		}
		if (!more) {
			// Nothing further of these kinds: the device can start from the newest value.
			cursor = Math.max(
				cursor,
				this.sql.exec<{ value: number }>('SELECT value FROM sync_counter WHERE id = 1').one().value
			);
		}
		return { results, changes, cursor, more };
	}

	/** Everything stored for this user, for "Download my data". */
	async exportAll(): Promise<{
		user: User | undefined;
		privacy: { version: string; acceptedAt: number } | undefined;
		sessions: Omit<DeviceSession, 'current'>[];
		docs: ProfileDoc[];
	}> {
		return {
			user: this.user(),
			privacy: this.privacy(),
			sessions: (await this.sessions('')).map((session) => {
				const { current, ...stored } = session;
				void current;
				return stored;
			}),
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
