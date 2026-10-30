/**
 * Accounts for admins (plan S27, Trevor 2026-10-30): find one account by its exact email or
 * username, then sign it out everywhere, remove its username or delete it. Never a list or a
 * search by part of a name, as Friends reaches accounts (worker/friends/routes.ts). Every
 * route answers 404 unless an admin account asks.
 *
 *   POST   /api/admin/accounts/find               { query }  -> { account: AdminAccount | null }
 *   POST   /api/admin/accounts/<id>/sign-out                 -> { account }
 *   POST   /api/admin/accounts/<id>/remove-username          -> { account }
 *   DELETE /api/admin/accounts/<id>                          -> 204
 *
 * The email travels in the body, never the URL, since Worker logs keep query strings.
 */
import { isLegacyAccountId, isWordAccountId } from './account-id.ts';

export const ADMIN_ACCOUNTS_API = '/api/admin/accounts';
export const ADMIN_ACCOUNTS_FIND = `${ADMIN_ACCOUNTS_API}/find`;

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

export interface FindAccountRequest {
	query: string;
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
