import {
	isReportStatus,
	parseReportDraft,
	parseReportIdPath,
	parseReportScriptPath,
	REPORT_OPTIONAL_FIELDS,
	REPORTS_API,
	type CreatedReport,
	type Report,
	type ReportList
} from '../src/lib/features/reports/reports-protocol.ts';
import { userStub, type AccountEnv } from './account/objects.ts';
import { getUser } from './account/routes.ts';
import { adminSignInTrusted, isAdmin, type AdminsEnv } from './admins.ts';
import { reportBox, type ReportBox } from './report-box.ts';

export { ReportBox } from './report-box.ts';

export interface ReportsEnv extends AccountEnv, AdminsEnv {
	/** Per-address limit on sending, against floods (wrangler.jsonc). */
	REPORT_CREATES: RateLimit;
	/** "off" only in the local e2e server, like SHARE_LIMITS. */
	SHARE_LIMITS?: string;
}

const noStore = { 'Cache-Control': 'no-store' };

function text(message: string, status: number): Response {
	return new Response(message, { status, headers: noStore });
}

/**
 * The list as `reader` may see it: admins everything; any other signed-in account the reports
 * sent from an account, without what they were sent with unless they sent them. Account ids
 * stay here: the reader gets the sender's username and whether it was them.
 */
async function reportList(
	env: ReportsEnv,
	box: DurableObjectStub<ReportBox>,
	reader: { userId?: string; admin: boolean; ownTrusted: boolean }
): Promise<ReportList> {
	const names = new Map<string, string | undefined>();
	const reports: Report[] = [];
	for (const { userId, ...report } of await box.list(!reader.admin)) {
		if (userId !== undefined) {
			if (!names.has(userId)) {
				names.set(userId, (await userStub(env, userId).profile())?.username ?? undefined);
			}
			report.fromAccount = true;
			const name = names.get(userId);
			if (name) report.reporter = name;
			if (userId === reader.userId) report.mine = true;
		}
		// Their own reports' details only where sign-in can be trusted (not on other previews).
		if (!reader.admin && !(report.mine && reader.ownTrusted)) {
			for (const key of REPORT_OPTIONAL_FIELDS) delete report[key];
			delete report.hasScript;
		}
		reports.push(report);
	}
	return { reports, admin: reader.admin };
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
	const box = reportBox(env);

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
		// Sent while signed in: stored with the account, so it shows under its user.
		const sender = await getUser(request, env);
		const id = await box.add(draft, Date.now(), sender?.userId);
		if (id === undefined) return text('Full', 503);
		return Response.json({ id } satisfies CreatedReport, { status: 201, headers: noStore });
	}

	// Reading: any signed-in account (reportList decides what it sees). Triage: an admin
	// account only. Answers 404 otherwise, so the routes don't advertise themselves.
	const auth = await getUser(request, env);
	if (!auth) return text('Not found', 404);
	const admin = await isAdmin(env, url, auth.user.email);
	const scriptId = parseReportScriptPath(url.pathname);
	if (scriptId !== undefined && request.method === 'GET') {
		// Like the rest of what it was sent with: for the admins and its sender. A data Worker
		// from before scripts has no `script` method; then there is none to show.
		const found = await box.script(scriptId).catch(() => undefined);
		const allowed =
			found && (admin || (found.userId === auth.userId && adminSignInTrusted(env, url)));
		return allowed
			? new Response(found.script, {
					headers: { ...noStore, 'Content-Type': 'application/json' }
				})
			: text('Not found', 404);
	}
	if (!admin && url.pathname === REPORTS_API && request.method === 'GET') {
		const ownTrusted = adminSignInTrusted(env, url);
		return Response.json(await reportList(env, box, { userId: auth.userId, admin, ownTrusted }), {
			headers: noStore
		});
	}
	if (!admin) return text('Not found', 404);
	if (request.method !== 'GET' && !fromApp(request, url)) {
		return text('This request must come from the app', 403);
	}

	if (url.pathname === REPORTS_API && request.method === 'GET') {
		return Response.json(
			await reportList(env, box, { userId: auth.userId, admin: true, ownTrusted: true }),
			{ headers: noStore }
		);
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
