import { DurableObject } from 'cloudflare:workers';
import {
	isReportStatus,
	parseReportDraft,
	parseReportIdPath,
	REPORT_OPTIONAL_FIELDS,
	REPORTS_ADMINS_API,
	REPORTS_API,
	type Admin,
	type AdminList,
	type CreatedReport,
	type Report,
	type ReportDraft,
	type ReportStatus
} from '../src/lib/features/reports/reports-protocol.ts';
import { normaliseEmail } from '../src/lib/features/account/account-protocol.ts';
import { sameHash, sha256 } from './account/crypto.ts';
import { userStub, type AccountEnv } from './account/objects.ts';
import { getUser } from './account/routes.ts';
import { adminSignInTrusted, type AdminsEnv } from './admins.ts';

export interface ReportsEnv extends AccountEnv, AdminsEnv {
	/** Per-address limit on sending, against floods (wrangler.jsonc). */
	REPORT_CREATES: RateLimit;
	/**
	 * Worker secret Trevor sets in Cloudflare. It opens the inbox and lets its holder name the
	 * first admin accounts; after that admins sign in instead. Unset: only admin accounts.
	 */
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

const noStore = { 'Cache-Control': 'no-store' };

function text(message: string, status: number): Response {
	return new Response(message, { status, headers: noStore });
}

async function holdsKey(request: Request, env: ReportsEnv): Promise<boolean> {
	const key = env.REPORTS_ADMIN_KEY;
	const given = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
	if (!key || !given) return false;
	return sameHash(await sha256(given), await sha256(key));
}

/** The signed-in account, when its sign-in can be trusted and it is an admin. */
async function adminAccount(
	request: Request,
	env: ReportsEnv,
	url: URL,
	box: DurableObjectStub<ReportBox>
): Promise<string | undefined> {
	if (!adminSignInTrusted(env, url)) return undefined;
	const auth = await getUser(request, env);
	return auth && (await box.isAdmin(auth.userId)) ? auth.userId : undefined;
}

/** Each admin with the account's current email; accounts deleted since are dropped. */
async function adminList(env: ReportsEnv, box: DurableObjectStub<ReportBox>): Promise<Admin[]> {
	const list: Admin[] = [];
	for (const id of await box.admins()) {
		const profile = await userStub(env, id).profile();
		if (profile) list.push({ id, email: profile.email });
		else await box.removeAdmin(id);
	}
	return list;
}

/** Cookie-signed changes must come from our own pages with a JSON body (as account/routes.ts). */
function fromApp(request: Request, url: URL): boolean {
	return (
		request.headers.get('Origin') === url.origin &&
		(request.headers.get('Content-Type') ?? '').startsWith('application/json')
	);
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

	// Reading and triage: an admin account, or the key. Answers 404 otherwise, so the routes
	// don't advertise themselves.
	const viaKey = await holdsKey(request, env);
	if (!viaKey && !(await adminAccount(request, env, url, box))) return text('Not found', 404);
	if (!viaKey && request.method !== 'GET' && !fromApp(request, url)) {
		return text('This request must come from the app', 403);
	}

	if (url.pathname === REPORTS_ADMINS_API) {
		if (request.method === 'GET') {
			return Response.json({ admins: await adminList(env, box) } satisfies AdminList, {
				headers: noStore
			});
		}
		const body = (await request.json().catch(() => null)) as {
			email?: unknown;
			id?: unknown;
		} | null;
		if (request.method === 'POST') {
			// Named by the email they sign in with today, stored by the account's id.
			const email = normaliseEmail(body?.email);
			if (!email) return text('Bad email', 400);
			const userId = await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(email)).ownerId();
			if (!userId) return text('No account', 404);
			await box.addAdmin(userId, Date.now());
		} else if (request.method === 'DELETE') {
			if (typeof body?.id !== 'string') return text('Bad id', 400);
			await box.removeAdmin(body.id);
		} else return text('Method not allowed', 405);
		return new Response(null, { status: 204, headers: noStore });
	}
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
