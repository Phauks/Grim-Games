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
import { remote, type DataBinding } from './shared-data.ts';

export interface ReportBoxEnv {
	REPORTS: DurableObjectNamespace<ReportBox>;
	DATA?: DataBinding;
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
}

/**
 * Every report and the admin list, in one SQLite Durable Object (`idFromName('all')`).
 * Durable Objects rather than D1, like accounts and shared scripts. Kept apart from
 * reports.ts so the shared data Worker can hold it without the app's routes.
 */
export class ReportBox extends DurableObject<ReportBoxEnv> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: ReportBoxEnv) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
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
				`INSERT INTO reports (kind, title, body, details, contact, page, build, device, created_at, user_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
				draft.kind,
				draft.title,
				draft.body,
				draft.details ?? null,
				draft.contact ?? null,
				draft.page ?? null,
				draft.build ?? null,
				draft.device ?? null,
				now,
				userId ?? null
			)
			.one().id;
	}

	/**
	 * Newest first, each with its sending account's id. `fromAccounts`: only those sent while
	 * signed in (what a non-admin may read).
	 */
	async list(fromAccounts = false): Promise<(Report & { userId?: string })[]> {
		return this.sql
			.exec<Row>(
				`SELECT * FROM reports ${fromAccounts ? 'WHERE user_id IS NOT NULL' : ''} ORDER BY id DESC`
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
					if (row[key] !== null) report[key] = row[key];
				}
				if (row.user_id !== null) report.userId = row.user_id;
				return report;
			});
	}

	async setStatus(id: number, status: ReportStatus): Promise<boolean> {
		return this.sql.exec('UPDATE reports SET status = ? WHERE id = ?', status, id).rowsWritten > 0;
	}

	async remove(id: number): Promise<boolean> {
		return this.sql.exec('DELETE FROM reports WHERE id = ?', id).rowsWritten > 0;
	}

	/**
	 * Accounts that may read and triage reports, by internal user id: people can change their
	 * email or username (Trevor, 2026-10-18), so neither may decide who is an admin.
	 */
	async admins(): Promise<string[]> {
		return this.sql
			.exec<{ user_id: string }>('SELECT user_id FROM admin_users ORDER BY added_at')
			.toArray()
			.map((row) => row.user_id);
	}

	async isAdmin(userId: string): Promise<boolean> {
		return (
			this.sql.exec('SELECT 1 FROM admin_users WHERE user_id = ?', userId).toArray().length > 0
		);
	}

	async addAdmin(userId: string, now: number): Promise<void> {
		this.sql.exec(
			'INSERT OR IGNORE INTO admin_users (user_id, added_at) VALUES (?, ?)',
			userId,
			now
		);
	}

	async removeAdmin(userId: string): Promise<void> {
		this.sql.exec('DELETE FROM admin_users WHERE user_id = ?', userId);
	}
}

/** This Worker's own ReportBox, which the shared data Worker also uses. */
export const localReports = (env: Pick<ReportBoxEnv, 'REPORTS'>, key = ALL) =>
	env.REPORTS.get(env.REPORTS.idFromName(key));

/** The ReportBox: the shared data Worker's when bound, else this Worker's own. */
export function reportBox(env: ReportBoxEnv): DurableObjectStub<ReportBox> {
	return env.DATA ? remote(env.DATA, 'reports', ALL) : localReports(env);
}
