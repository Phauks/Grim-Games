import { fetchWithTimeout } from '#lib/ui/fetch.ts';
import {
	ADMIN_ACCOUNTS_LIST,
	adminAccountPath,
	type AdminAccount,
	type AdminAccountAction,
	type AdminAccountList,
	type AdminAccountResponse
} from './admin-accounts-protocol.ts';

/** Not an admin account (or signed out): the Worker answers 404. */
export class NotAdminError extends Error {}

/** Every route wants a JSON body from our own page (worker/admin-accounts.ts). */
function call(path: string, method: string, body: unknown = {}): Promise<Response> {
	return fetchWithTimeout(path, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function read<T>(response: Response): Promise<T> {
	if (response.status === 404) throw new NotAdminError();
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return (await response.json()) as T;
}

/** Every account, by email (plan S27). */
export async function listAccounts(): Promise<AdminAccount[]> {
	return (await read<AdminAccountList>(await call(ADMIN_ACCOUNTS_LIST, 'POST'))).accounts;
}

/** Runs an action on an account and returns it as it is now. */
export async function changeAccount(
	id: string,
	action: AdminAccountAction
): Promise<AdminAccount | null> {
	return (await read<AdminAccountResponse>(await call(adminAccountPath(id, action), 'POST')))
		.account;
}

export async function deleteAccount(id: string): Promise<void> {
	const response = await call(adminAccountPath(id), 'DELETE');
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
