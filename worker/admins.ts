/**
 * Who is an admin: an account in ReportBox's `admin_users`, named by an admin or the holder
 * of REPORTS_ADMIN_KEY (reports.ts). Kept apart from reports.ts so the account routes can
 * ask too (Trevor, 2026-10-18: Account settings shows User or Admin) without importing it.
 */
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
}

/** Whether a signed-in account can be trusted to be who it says, for admin rights here. */
export function adminSignInTrusted(env: AdminsEnv, url: URL): boolean {
	return emailSender(env, url).delivery === 'email' || env.ADMINS_TRUST_PREVIEW_SIGN_IN === 'on';
}

/** Whether `userId` is an admin on this site (false where sign-in can't be trusted). */
export async function isAdmin(env: AdminsEnv, url: URL, userId: string): Promise<boolean> {
	if (!adminSignInTrusted(env, url)) return false;
	return env.REPORTS.get(env.REPORTS.idFromName('all')).isAdmin(userId);
}
