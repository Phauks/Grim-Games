import {
	REPORTS_ADMINS_API,
	REPORTS_API,
	type Admin,
	type AdminList,
	type CreatedReport,
	type ReportDraft,
	type ReportList,
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

/**
 * The session cookie says who is asking; the Worker decides what they may do. Changes go as
 * JSON, which the Worker requires of them (fromApp in worker/reports.ts).
 */
const json: HeadersInit = { 'Content-Type': 'application/json' };

/** The reports this account may read, newest first; undefined when signed out. */
export async function listReports(): Promise<ReportList | undefined> {
	const response = await fetch(REPORTS_API);
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as ReportList;
}

export async function setReportStatus(id: number, status: ReportStatus) {
	const response = await fetch(`${REPORTS_API}/${id}`, {
		method: 'PATCH',
		headers: json,
		body: JSON.stringify({ status })
	});
	if (!response.ok) throw new Error(await response.text());
}

export async function deleteReport(id: number) {
	const response = await fetch(`${REPORTS_API}/${id}`, {
		method: 'DELETE',
		headers: json
	});
	if (!response.ok) throw new Error(await response.text());
}

export async function listAdmins(): Promise<Admin[]> {
	const response = await fetch(REPORTS_ADMINS_API);
	if (!response.ok) throw new Error(await response.text());
	return ((await response.json()) as AdminList).admins;
}

/** False when nobody has signed in with that email yet. */
export async function addAdmin(email: string): Promise<boolean> {
	const response = await fetch(REPORTS_ADMINS_API, {
		method: 'POST',
		headers: json,
		body: JSON.stringify({ email })
	});
	if (response.status === 404) return false;
	if (!response.ok) throw new Error(await response.text());
	return true;
}

export async function removeAdmin(id: string) {
	const response = await fetch(REPORTS_ADMINS_API, {
		method: 'DELETE',
		headers: json,
		body: JSON.stringify({ id })
	});
	if (!response.ok) throw new Error(await response.text());
}
