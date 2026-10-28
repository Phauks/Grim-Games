import { fetchWithTimeout, SLOW_FETCH_TIMEOUT_MS } from '#lib/ui/fetch.ts';

import {
	REPORTS_API,
	reportScriptPath,
	type CreatedReport,
	type ReportDraft,
	type ReportList,
	type ReportStatus
} from './reports-protocol.ts';

/** The Worker answered a report with an error status (no connection throws a TypeError). */
export class ReportRefused extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

/**
 * Sends a report; the id it was stored under. Throws ReportRefused when the Worker refuses
 * it, or fetch's own error when there is no connection. The app sends through the outbox
 * (outbox.svelte.ts), which keeps a report on the device until it is sent.
 */
export async function sendReport(draft: ReportDraft): Promise<number> {
	const response = await fetchWithTimeout(REPORTS_API, {
		method: 'POST',
		// A report can carry a screenshot.
		timeoutMs: SLOW_FETCH_TIMEOUT_MS,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(draft)
	});
	if (!response.ok) throw new ReportRefused(response.status, await response.text());
	return ((await response.json()) as CreatedReport).id;
}

/**
 * The session cookie says who is asking; the Worker decides what they may do. Changes go as
 * JSON, which the Worker requires of them (fromApp in worker/reports.ts).
 */
const json: HeadersInit = { 'Content-Type': 'application/json' };

/** The reports this account may read, newest first; undefined when signed out. */
export async function listReports(): Promise<ReportList | undefined> {
	const response = await fetchWithTimeout(REPORTS_API);
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as ReportList;
}

export async function setReportStatus(id: number, status: ReportStatus) {
	const response = await fetchWithTimeout(`${REPORTS_API}/${id}`, {
		method: 'PATCH',
		headers: json,
		body: JSON.stringify({ status })
	});
	if (!response.ok) throw new Error(await response.text());
}

export async function deleteReport(id: number) {
	const response = await fetchWithTimeout(`${REPORTS_API}/${id}`, {
		method: 'DELETE',
		headers: json
	});
	if (!response.ok) throw new Error(await response.text());
}

/** The script a report was sent with, as TPI's JSON; undefined when there is none to show. */
export async function fetchReportScript(id: number): Promise<unknown[] | undefined> {
	const response = await fetchWithTimeout(reportScriptPath(id));
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as unknown[];
}
