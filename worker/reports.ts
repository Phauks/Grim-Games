import { DurableObject } from 'cloudflare:workers';
import {
	isReportStatus,
	parseReportDraft,
	parseReportIdPath,
	REPORT_OPTIONAL_FIELDS,
	REPORTS_API,
	type CreatedReport,
	type Report,
	type ReportDraft,
	type ReportStatus
} from '../src/lib/features/reports/reports-protocol.ts';
import { sameHash, sha256 } from './account/crypto.ts';

export interface ReportsEnv {
	REPORTS: DurableObjectNamespace<ReportBox>;
	/** Per-address limit on sending, against floods (wrangler.jsonc). */
	REPORT_CREATES: RateLimit;
	/** Worker secret Trevor sets in Cloudflare; reading reports needs it. Unset: reading is off. */
	REPORTS_ADMIN_KEY?: string;
	/** "off" only in the local e2e server, like SHARE_LIMITS. */
	SHARE_LIMITS?: string;
}

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
}

/**
 * Every report, in one SQLite Durable Object (`idFromName('all')`). Durable Objects rather
 * than D1, like rooms, shared scripts and accounts, so each Worker Preview gets its own
 * storage with no extra setup.
 */
export class ReportBox extends DurableObject<ReportsEnv> {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: ReportsEnv) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		this.sql.exec(`
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
	}

	async add(draft: ReportDraft, now: number): Promise<number | undefined> {
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
				`INSERT INTO reports (kind, title, body, details, contact, page, build, device, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
				draft.kind,
				draft.title,
				draft.body,
				draft.details ?? null,
				draft.contact ?? null,
				draft.page ?? null,
				draft.build ?? null,
				draft.device ?? null,
				now
			)
			.one().id;
	}

	async list(): Promise<Report[]> {
		return this.sql
			.exec<Row>('SELECT * FROM reports ORDER BY id DESC')
			.toArray()
			.map((row) => {
				const report: Report = {
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
				return report;
			});
	}

	async setStatus(id: number, status: ReportStatus): Promise<boolean> {
		return this.sql.exec('UPDATE reports SET status = ? WHERE id = ?', status, id).rowsWritten > 0;
	}

	async remove(id: number): Promise<boolean> {
		return this.sql.exec('DELETE FROM reports WHERE id = ?', id).rowsWritten > 0;
	}
}

const noStore = { 'Cache-Control': 'no-store' };

function text(message: string, status: number): Response {
	return new Response(message, { status, headers: noStore });
}

async function isAdmin(request: Request, env: ReportsEnv): Promise<boolean> {
	const key = env.REPORTS_ADMIN_KEY;
	const given = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
	if (!key || !given) return false;
	return sameHash(await sha256(given), await sha256(key));
}

/** Handles `/api/reports` and `/api/reports/<id>`; undefined for other paths. */
export async function handleReports(
	request: Request,
	env: ReportsEnv,
	url: URL
): Promise<Response | undefined> {
	if (url.pathname !== REPORTS_API && !url.pathname.startsWith(`${REPORTS_API}/`)) return undefined;
	const box = env.REPORTS.get(env.REPORTS.idFromName('all'));

	if (url.pathname === REPORTS_API && request.method === 'POST') {
		// Rate limits key on the caller's address; it is not stored with the report.
		const caller = request.headers.get('CF-Connecting-IP') ?? 'unknown';
		if (env.SHARE_LIMITS !== 'off' && !(await env.REPORT_CREATES.limit({ key: caller })).success) {
			return text('Slow down', 429);
		}
		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			return text('Not JSON', 400);
		}
		const draft = parseReportDraft(raw);
		if ('error' in draft) return text(draft.error, 400);
		const id = await box.add(draft, Date.now());
		if (id === undefined) return text('Full', 503);
		return Response.json({ id } satisfies CreatedReport, { status: 201, headers: noStore });
	}

	// Reading and triage: only with the admin key. Answers 404 otherwise, so the routes don't
	// advertise themselves.
	if (!(await isAdmin(request, env))) return text('Not found', 404);
	if (url.pathname === REPORTS_API && request.method === 'GET') {
		return Response.json({ reports: await box.list() }, { headers: noStore });
	}
	const id = parseReportIdPath(url.pathname);
	if (id === undefined) return text('Not found', 404);
	if (request.method === 'PATCH') {
		const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
		if (!isReportStatus(body?.status)) return text('Bad status', 400);
		return (await box.setStatus(id, body.status))
			? new Response(null, { status: 204, headers: noStore })
			: text('Not found', 404);
	}
	if (request.method === 'DELETE') {
		return (await box.remove(id))
			? new Response(null, { status: 204, headers: noStore })
			: text('Not found', 404);
	}
	return text('Method not allowed', 405);
}
