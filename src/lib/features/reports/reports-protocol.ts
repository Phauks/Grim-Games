/**
 * In-app reports (Trevor, 2026-10-17): bugs, enhancement requests and the other kinds the
 * GitHub issue forms offer, sent to our Worker instead of GitHub so nobody needs an account.
 * Shared by the app and the Worker (worker/reports.ts).
 *
 *   POST   /api/reports              body: ReportDraft            -> 201 { id }
 *   GET    /api/reports              (signed in)                  -> 200 ReportList
 *   PATCH  /api/reports/<id>         (admin) { status }           -> 204
 *   DELETE /api/reports/<id>         (admin)                      -> 204
 *
 *   GET    /api/reports/admins                                    -> 200 { admins: Admin[] }
 *   POST   /api/reports/admins       { email }                    -> 204, 404 no such account
 *   DELETE /api/reports/admins       { id }                       -> 204
 *
 * Triage and the admin list need a signed-in admin account (Trevor, 2026-10-18) or the Worker
 * secret REPORTS_ADMIN_KEY as a Bearer token; otherwise they answer 404. Any signed-in account
 * reads the reports sent from an account (Trevor, 2026-10-19: filter by user, and set yourself
 * as the user easily); what a report was sent with stays with its sender and the admins.
 */
export const REPORTS_API = '/api/reports';
export const REPORTS_ADMINS_API = '/api/reports/admins';

/** An account that may read reports: stored by user id, shown by its current email. */
export interface Admin {
	id: string;
	email: string;
}

export interface AdminList {
	admins: Admin[];
}

/** The same kinds as `.github/ISSUE_TEMPLATE/`. */
export const REPORT_KINDS = ['bug', 'enhancement', 'rules', 'data', 'question'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_STATUSES = ['new', 'accepted', 'done', 'declined'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_LIMITS = {
	title: 120,
	body: 4000,
	details: 12_000,
	contact: 200,
	page: 200,
	build: 200,
	device: 400
} as const;

/** What the app sends. `details` is only there when the person chose to include it. */
export interface ReportDraft {
	kind: ReportKind;
	title: string;
	body: string;
	details?: string;
	contact?: string;
	page?: string;
	build?: string;
	/** The browser's own description (user agent). */
	device?: string;
}

export interface Report extends ReportDraft {
	id: number;
	status: ReportStatus;
	createdAt: number;
	/** Sent while signed in to an account; reports sent signed out are for admins only. */
	fromAccount?: boolean;
	/** The sender's username today, when the account has one. */
	reporter?: string;
	/** Sent from the account reading the list. */
	mine?: boolean;
}

/** What the list shows the reader: everything to an admin, else the public part (above). */
export interface ReportList {
	reports: Report[];
	/** The reader may triage (status, delete, admins). */
	admin: boolean;
}

export interface CreatedReport {
	id: number;
}

/** What a report was sent with: shown only to its sender and the admins. */
export const REPORT_OPTIONAL_FIELDS = ['details', 'contact', 'page', 'build', 'device'] as const;

export function isReportKind(value: unknown): value is ReportKind {
	return (REPORT_KINDS as readonly unknown[]).includes(value);
}

export function isReportStatus(value: unknown): value is ReportStatus {
	return (REPORT_STATUSES as readonly unknown[]).includes(value);
}

function optional(value: unknown, max: number): string | undefined | false {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string' || value.length > max) return false;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

/** A well-formed draft, or why not. Used by the Worker; the form enforces the same limits. */
export function parseReportDraft(raw: unknown): ReportDraft | { error: string } {
	if (typeof raw !== 'object' || raw === null) return { error: 'Not a report' };
	const input = raw as Record<string, unknown>;
	if (!isReportKind(input.kind)) return { error: 'Unknown kind' };
	const title = typeof input.title === 'string' ? input.title.trim() : '';
	const body = typeof input.body === 'string' ? input.body.trim() : '';
	if (!title || title.length > REPORT_LIMITS.title) return { error: 'Bad title' };
	if (!body || body.length > REPORT_LIMITS.body) return { error: 'Bad description' };
	const draft: ReportDraft = { kind: input.kind, title, body };
	for (const key of REPORT_OPTIONAL_FIELDS) {
		const value = optional(input[key], REPORT_LIMITS[key]);
		if (value === false) return { error: `Bad ${key}` };
		if (value !== undefined) draft[key] = value;
	}
	return draft;
}

/** `/api/reports/<id>` -> id, else undefined. */
export function parseReportIdPath(pathname: string): number | undefined {
	const match = pathname.match(/^\/api\/reports\/(\d{1,9})$/);
	return match ? Number(match[1]) : undefined;
}
