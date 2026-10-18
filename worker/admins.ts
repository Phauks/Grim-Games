/**
 * Who is an admin: an account in ReportBox's `admin_users`, added by another admin in the
 * Reports inbox. Nobody can add the first one from the app (Trevor, 2026-10-18: no admin key);
 * it is a row added in the database itself: Cloudflare dashboard, Durable Objects, ReportBox,
 * Data Studio, object `all`, then
 *   INSERT INTO admin_users (user_id, added_at) VALUES ('<account id>', unixepoch() * 1000);
 * with the account id from Account settings. Kept apart from reports.ts so the account routes
 * can ask too (Account settings shows User or Admin) without importing it.
 */
import { normaliseEmail } from '../src/lib/features/account/account-protocol.ts';
import { emailSender, type EmailEnv } from './account/email.ts';
import type { ReportBox } from './reports.ts';

export interface AdminsEnv extends EmailEnv {
	REPORTS: DurableObjectNamespace<ReportBox>;
	/**
	 * "on" only in the local e2e server: trusts sign-ins whose code is shown on screen. Admin
	 * accounts otherwise count only where sign-in codes really go by email, since a preview
	 * shows the code to whoever asks for it (account/email.ts).
	 */
	ADMINS_TRUST_PREVIEW_SIGN_IN?: string;
	/** Comma-separated sign-in emails that are admins too; set by the local e2e server. */
	ADMIN_EMAILS?: string;
}

/** Whether a signed-in account can be trusted to be who it says, for admin rights here. */
export function adminSignInTrusted(env: AdminsEnv, url: URL): boolean {
	return emailSender(env, url).delivery === 'email' || env.ADMINS_TRUST_PREVIEW_SIGN_IN === 'on';
}

/** Whether the account is an admin on this site (false where sign-in can't be trusted). */
export async function isAdmin(
	env: AdminsEnv,
	url: URL,
	account: { userId: string; email: string }
): Promise<boolean> {
	if (!adminSignInTrusted(env, url)) return false;
	const email = normaliseEmail(account.email);
	const listed = (env.ADMIN_EMAILS ?? '').split(',').map((entry) => normaliseEmail(entry));
	if (email && listed.includes(email)) return true;
	return env.REPORTS.get(env.REPORTS.idFromName('all')).isAdmin(account.userId);
}
