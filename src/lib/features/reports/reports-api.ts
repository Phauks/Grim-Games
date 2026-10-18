import {
	REPORTS_ADMINS_API,
	REPORTS_API,
	type Admin,
	type AdminList,
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

/** Admin requests carry the signed-in account's session cookie and a JSON body. */
const admin: HeadersInit = { 'Content-Type': 'application/json' };

/** Every report, newest first; undefined when this account may not read them. */
export async function listReports(): Promise<Report[] | undefined> {
	const response = await fetch(REPORTS_API, { headers: admin });
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return ((await response.json()) as { reports: Report[] }).reports;
}

export async function setReportStatus(id: number, status: ReportStatus) {
	const response = await fetch(`${REPORTS_API}/${id}`, {
		method: 'PATCH',
		headers: admin,
		body: JSON.stringify({ status })
	});
	if (!response.ok) throw new Error(await response.text());
}

export async function deleteReport(id: number) {
	const response = await fetch(`${REPORTS_API}/${id}`, { method: 'DELETE', headers: admin });
	if (!response.ok) throw new Error(await response.text());
}

export async function listAdmins(): Promise<Admin[]> {
	const response = await fetch(REPORTS_ADMINS_API, { headers: admin });
	if (!response.ok) throw new Error(await response.text());
	return ((await response.json()) as AdminList).admins;
}

/** False when nobody has signed in with that email yet. */
export async function addAdmin(email: string): Promise<boolean> {
	const response = await fetch(REPORTS_ADMINS_API, {
		method: 'POST',
		headers: admin,
		body: JSON.stringify({ email })
	});
	if (response.status === 404) return false;
	if (!response.ok) throw new Error(await response.text());
	return true;
}

export async function removeAdmin(id: string) {
	const response = await fetch(REPORTS_ADMINS_API, {
		method: 'DELETE',
		headers: admin,
		body: JSON.stringify({ id })
	});
	if (!response.ok) throw new Error(await response.text());
}
