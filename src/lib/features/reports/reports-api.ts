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

/** A signed-in admin account needs no key: the session cookie goes with the request. */
function admin(key: string): HeadersInit {
	return key
		? { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
		: { 'Content-Type': 'application/json' };
}

/**
 * The reports this account (or the key) may read, newest first; undefined when signed out
 * without the key.
 */
export async function listReports(key: string): Promise<ReportList | undefined> {
	const response = await fetch(REPORTS_API, { headers: admin(key) });
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(await response.text());
	return (await response.json()) as ReportList;
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

export async function listAdmins(key: string): Promise<Admin[]> {
	const response = await fetch(REPORTS_ADMINS_API, { headers: admin(key) });
	if (!response.ok) throw new Error(await response.text());
	return ((await response.json()) as AdminList).admins;
}

/** False when nobody has signed in with that email yet. */
export async function addAdmin(key: string, email: string): Promise<boolean> {
	const response = await fetch(REPORTS_ADMINS_API, {
		method: 'POST',
		headers: admin(key),
		body: JSON.stringify({ email })
	});
	if (response.status === 404) return false;
	if (!response.ok) throw new Error(await response.text());
	return true;
}

export async function removeAdmin(key: string, id: string) {
	const response = await fetch(REPORTS_ADMINS_API, {
		method: 'DELETE',
		headers: admin(key),
		body: JSON.stringify({ id })
	});
	if (!response.ok) throw new Error(await response.text());
}
