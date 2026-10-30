/**
 * Who is an admin: a sign-in email in the ADMIN_EMAILS secret (report-box.ts), and nothing else
 * (Trevor, 2026-10-22: no admin key, no admin list in the app). Kept apart
 * from reports.ts so the account routes can ask too (Trevor, 2026-10-18: Account settings
 * shows User or Admin) without importing it.
 */
import { emailSender, type EmailEnv } from './account/email.ts';
import { listedAdmin, reportBox, type ReportBoxEnv } from './report-box.ts';

export interface AdminsEnv extends EmailEnv, ReportBoxEnv {
	/**
	 * "on" only in the local e2e server: trusts sign-ins whose code is shown on screen. Admin
	 * accounts otherwise count only where sign-in codes really go by email, since a local run
	 * shows the code to whoever asks for it (account/email.ts).
	 */
	ADMINS_TRUST_PREVIEW_SIGN_IN?: string;
}

/** Whether a signed-in account can be trusted to be who it says, for admin rights here. */
export function adminSignInTrusted(env: AdminsEnv, url: URL): boolean {
	return emailSender(env, url).delivery === 'email' || env.ADMINS_TRUST_PREVIEW_SIGN_IN === 'on';
}

/**
 * Whether the account signed in with `email` is an admin on this site (false where sign-in can't be
 * trusted). ADMIN_EMAILS is read where the reports are kept; this Worker's own copy only
 * matters without the shared data Worker (the local e2e server sets it).
 */
export async function isAdmin(env: AdminsEnv, url: URL, email: string): Promise<boolean> {
	if (!adminSignInTrusted(env, url)) return false;
	if (listedAdmin(env.ADMIN_EMAILS, email)) return true;
	return reportBox(env).isAdmin(email);
}
