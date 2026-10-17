import {
	REPORTS_API,
	type CreatedReport,
	type Report,
	type ReportDraft,
	type ReportStatus
} from './reports-protocol.ts';

/** Sends a report; the id it was stored under, or an Error. */
export async function sendReport(draft: ReportDraft): Promise<number> {
	const response = await fetch(REPORTS_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(draft)
	});
	if (!response.ok) throw new Error(await response.text());
	return ((await response.json()) as CreatedReport).id;
}

function admin(key: string): HeadersInit {
	return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

/** Every report, newest first; undefined when the key is wrong. */
export async function listReports(key: string): Promise<Report[] | undefined> {
	const response = await fetch(REPORTS_API, { headers: admin(key) });
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return ((await response.json()) as { reports: Report[] }).reports;
}

export async function setReportStatus(key: string, id: number, status: ReportStatus) {
	const response = await fetch(`${REPORTS_API}/${id}`, {
		method: 'PATCH',
		headers: admin(key),
		body: JSON.stringify({ status })
	});
	if (!response.ok) throw new Error(await response.text());
}

export async function deleteReport(key: string, id: number) {
	const response = await fetch(`${REPORTS_API}/${id}`, { method: 'DELETE', headers: admin(key) });
	if (!response.ok) throw new Error(await response.text());
}
