/**
 * Where reports and admins are kept. With `DATA` bound, in the shared data Worker
 * (worker/shared-data.ts), so production and every preview see the same reports and admins
 * (Trevor, 2026-10-19: "I would prefer it all uses the same"). Without it, this Worker's own
 * object, as before; REPORTS stays bound either way, so its data is never deleted.
 */
import { DurableObject } from 'cloudflare:workers';
import {
	REPORT_OPTIONAL_FIELDS,
	type Report,
	type ReportDraft,
	type ReportStatus
} from '../src/lib/features/reports/reports-protocol.ts';
import { normaliseEmail } from '../src/lib/features/account/account-protocol.ts';
import { remote, type DataBinding } from './shared-data.ts';

export interface ReportBoxEnv {
	REPORTS: DurableObjectNamespace<ReportBox>;
	DATA?: DataBinding;
	/**
	 * Comma-separated sign-in emails of the admins (Trevor, 2026-10-22: "set it in Cloudflare";
	 * admin is inherent by user type, nothing to manage in the app). Set as a secret on the
	 * Worker holding the reports, `grim-games-data`, so it stays out of this public repo and
	 * survives deploys.
	 */
	ADMIN_EMAILS?: string;
}

/** Whether `email` is one of the comma-separated `list`. */
export function listedAdmin(list: string | undefined, email: string | undefined): boolean {
	const wanted = normaliseEmail(email);
	if (!wanted || !list) return false;
	return list.split(',').some((entry) => normaliseEmail(entry) === wanted);
}

/** The one ReportBox there is. */
const ALL = 'all';

/** Stored reports stop growing here; the oldest finished ones make room first. */
const MAX_STORED = 5000;

interface Row extends Record<string, SqlStorageValue> {
	id: number;
	kind: string;
	title: string;
	body: string;
	details: string | null;
	contact: string | null;
	page: string | null;
	build: string | null;
	device: string | null;
	status: string;
	created_at: number;
	user_id: string | null;
	script_name: string | null;
	has_script: number;
}

/**
 * Every report, in one SQLite Durable Object (`idFromName('all')`).
 * Durable Objects rather than D1, like accounts and shared scripts. Kept apart from
 * reports.ts so the shared data Worker can hold it without the app's routes.
 */
export class ReportBox extends DurableObject<ReportBoxEnv> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: ReportBoxEnv) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		// admin_users held admins added in the app until 2026-10-22; no longer read, never dropped.
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS admin_users (
				user_id TEXT PRIMARY KEY,
				added_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS reports (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				kind TEXT NOT NULL,
				title TEXT NOT NULL,
				body TEXT NOT NULL,
				details TEXT,
				contact TEXT,
				page TEXT,
				build TEXT,
				device TEXT,
				status TEXT NOT NULL DEFAULT 'new',
				created_at INTEGER NOT NULL
			);
		`);
		// The sending account (Trevor, 2026-10-19: filter reports by user). Reports stored
		// before it, and those sent signed out, have none.
		const columns = this.sql.exec<{ name: string }>('PRAGMA table_info(reports)').toArray();
		if (!columns.some((c) => c.name === 'user_id')) {
			this.sql.exec('ALTER TABLE reports ADD COLUMN user_id TEXT');
		}
		// The script it was sent from (Trevor, 2026-10-22), as TPI's JSON, and its name.
		if (!columns.some((c) => c.name === 'script')) {
			this.sql.exec('ALTER TABLE reports ADD COLUMN script TEXT');
			this.sql.exec('ALTER TABLE reports ADD COLUMN script_name TEXT');
		}
	}

	async add(draft: ReportDraft, now: number, userId?: string): Promise<number | undefined> {
		const count = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM reports').one().n;
		if (count >= MAX_STORED) {
			this.sql.exec(
				`DELETE FROM reports WHERE id IN (SELECT id FROM reports
				 WHERE status IN ('done', 'declined') ORDER BY id LIMIT ?)`,
				count - MAX_STORED + 1
			);
			const left = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM reports').one().n;
			if (left >= MAX_STORED) return undefined;
		}
		return this.sql
			.exec<{ id: number }>(
				`INSERT INTO reports (kind, title, body, details, contact, page, build, device, created_at,
				 user_id, script, script_name)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
				draft.kind,
				draft.title,
				draft.body,
				draft.details ?? null,
				draft.contact ?? null,
				draft.page ?? null,
				draft.build ?? null,
				draft.device ?? null,
				now,
				userId ?? null,
				draft.script ?? null,
				draft.script ? (draft.scriptName ?? null) : null
			)
			.one().id;
	}

	/**
	 * Newest first, each with its sending account's id. `fromAccounts`: only those sent while
	 * signed in (what a non-admin may read). Scripts are left out (`script`). `withScripts`:
	 * include whether each has one and its name; an app from before scripts doesn't ask, as it
	 * wouldn't keep them from other readers (the data Worker deploys from beta before main).
	 */
	async list(fromAccounts = false, withScripts = false): Promise<(Report & { userId?: string })[]> {
		return this.sql
			.exec<Row>(
				`SELECT id, kind, title, body, details, contact, page, build, device, status, created_at,
				 user_id, script_name, script IS NOT NULL AS has_script
				 FROM reports ${fromAccounts ? 'WHERE user_id IS NOT NULL' : ''} ORDER BY id DESC`
			)
			.toArray()
			.map((row) => {
				const report: Report & { userId?: string } = {
					id: row.id,
					kind: row.kind as Report['kind'],
					title: row.title,
					body: row.body,
					status: row.status as ReportStatus,
					createdAt: row.created_at
				};
				for (const key of REPORT_OPTIONAL_FIELDS) {
					if (key === 'scriptName' && !withScripts) continue;
					const value = row[key === 'scriptName' ? 'script_name' : key];
					if (value !== null) report[key] = value;
				}
				if (withScripts && row.has_script) report.hasScript = true;
				if (row.user_id !== null) report.userId = row.user_id;
				return report;
			});
	}

	/** A report's script and its sending account's id; undefined when it has no script. */
	async script(id: number): Promise<{ script: string; userId?: string } | undefined> {
		const row = this.sql
			.exec<{ script: string | null; user_id: string | null }>(
				'SELECT script, user_id FROM reports WHERE id = ?',
				id
			)
			.toArray()[0];
		if (!row?.script) return undefined;
		return row.user_id === null
			? { script: row.script }
			: { script: row.script, userId: row.user_id };
	}

	async setStatus(id: number, status: ReportStatus): Promise<boolean> {
		return this.sql.exec('UPDATE reports SET status = ? WHERE id = ?', status, id).rowsWritten > 0;
	}

	async remove(id: number): Promise<boolean> {
		return this.sql.exec('DELETE FROM reports WHERE id = ?', id).rowsWritten > 0;
	}

	/** Whether the account signing in with `email` is in ADMIN_EMAILS. */
	async isAdmin(email: string): Promise<boolean> {
		return listedAdmin(this.env.ADMIN_EMAILS, email);
	}
}

/** This Worker's own ReportBox, which the shared data Worker also uses. */
export const localReports = (env: Pick<ReportBoxEnv, 'REPORTS'>, key = ALL) =>
	env.REPORTS.get(env.REPORTS.idFromName(key));

/** The ReportBox: the shared data Worker's when bound, else this Worker's own. */
export function reportBox(env: ReportBoxEnv): DurableObjectStub<ReportBox> {
	return env.DATA ? remote(env.DATA, 'reports', ALL) : localReports(env);
}
