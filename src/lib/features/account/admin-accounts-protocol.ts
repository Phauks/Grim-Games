/**
 * Accounts for admins (plan S27, Trevor 2026-10-30: "accounts should allow seeing all accounts
 * as a base, and clicking into an account opens a modal for the details"): every account, then
 * sign one out everywhere, remove its username or delete it. Every route answers 404 unless an
 * admin account asks.
 *
 *   POST   /api/admin/accounts/list                         -> { accounts: AdminAccount[] }
 *   POST   /api/admin/accounts/<id>/sign-out                 -> { account: AdminAccount | null }
 *   POST   /api/admin/accounts/<id>/remove-username          -> { account }
 *   DELETE /api/admin/accounts/<id>                          -> 204
 *
 * No email ever travels in the URL, since Worker logs keep query strings.
 */
import { isLegacyAccountId, isWordAccountId } from './account-id.ts';

export const ADMIN_ACCOUNTS_API = '/api/admin/accounts';
export const ADMIN_ACCOUNTS_LIST = `${ADMIN_ACCOUNTS_API}/list`;

/** What an admin sees of one account. */
export interface AdminAccount {
	id: string;
	email: string;
	username: string | null;
	hasPassword: boolean;
	createdAt: number;
	/** Devices signed in now. */
	devices: number;
	/** When any of them was last used; undefined with none signed in. */
	lastSeenAt?: number;
	/** Named in ADMIN_EMAILS. */
	admin: boolean;
}

export interface AdminAccountList {
	accounts: AdminAccount[];
}

export interface AdminAccountResponse {
	account: AdminAccount | null;
}

export type AdminAccountAction = 'sign-out' | 'remove-username';

/** The path of one account, or of an action on it. */
export function adminAccountPath(id: string, action?: AdminAccountAction): string {
	return `${ADMIN_ACCOUNTS_API}/${id}${action ? `/${action}` : ''}`;
}

/** The account id and action in a path, or undefined for any other path. */
export function parseAdminAccountPath(
	pathname: string
): { id: string; action?: AdminAccountAction } | undefined {
	const match = /^\/api\/admin\/accounts\/([a-z0-9-]{1,80})(?:\/(sign-out|remove-username))?$/.exec(
		pathname
	);
	if (!match || !(isWordAccountId(match[1]) || isLegacyAccountId(match[1]))) return undefined;
	return match[2] ? { id: match[1], action: match[2] as AdminAccountAction } : { id: match[1] };
}

/** The list's order: by email, so an account keeps its place as it is used. */
export function sortAdminAccounts(accounts: readonly AdminAccount[]): AdminAccount[] {
	return [...accounts].sort((a, b) => a.email.localeCompare(b.email) || a.id.localeCompare(b.id));
}

/** Whether an account's email, username or id holds the filter's text, in any case. */
export function adminAccountMatches(account: AdminAccount, filter: string): boolean {
	const wanted = filter.trim().toLowerCase();
	if (!wanted) return true;
	return [account.email, account.username ?? '', account.id].some((text) =>
		text.toLowerCase().includes(wanted)
	);
}
