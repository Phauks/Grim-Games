/**
 * Sending sign-in emails, behind one interface so the real provider slots in later.
 *
 * Production sends real email through Cloudflare Email Service: the `send_email` binding
 * `EMAIL` and the var `EMAIL_FROM` in wrangler.jsonc. It only sends from a domain onboarded
 * in Email Service on the same account (developers.cloudflare.com/email-service/platform/limits/).
 * - Previews and local runs have no binding and use `PreviewSender`: nothing is sent; the code
 *   and link go to the Worker log and back to the page, which shows them on screen;
 * - production without the binding or var has no sender, so sign-in is switched off there.
 *
 * The link in the email is built from the address the request came in on (routes.ts), so the
 * only domain-specific value here is `EMAIL_FROM`.
 */
import type { EmailDelivery } from '../../src/lib/features/account/account-protocol.ts';
import { shell } from '../../src/lib/i18n/messages/en/shell.ts';

/** The app's name as users see it, shared with the header. */
const APP_NAME = shell['shell.appName'];

/** One email: who it goes to, and what it says. */
export interface Email {
	to: string;
	subject: string;
	text: string;
}

export interface EmailSender {
	readonly delivery: EmailDelivery;
	send(message: Email): Promise<void>;
}

/** The Email Service binding (developers.cloudflare.com/email-service/api/send-emails/workers-api/). */
export interface EmailBinding {
	send(message: {
		to: string;
		from: string | { email: string; name?: string };
		subject: string;
		text: string;
		html?: string;
	}): Promise<{ messageId: string }>;
}

export interface EmailEnv {
	ENVIRONMENT?: string;
	EMAIL?: EmailBinding;
	/** The sending address alone, for example `sign-in@grimbinder.com`. */
	EMAIL_FROM?: string;
}

/** The sign-in code and link. */
export function signInEmail(to: string, code: string, link: string): Email {
	return {
		to,
		subject: `${APP_NAME} sign-in code: ${code}`,
		text: [
			`Your ${APP_NAME} sign-in code is ${code}.`,
			'',
			`Or open this link on the device you are signing in on:`,
			link,
			'',
			'The code and link work for 10 minutes. If you did not ask to sign in, ignore this email.'
		].join('\n')
	};
}

/** The code that confirms a new address for an existing account. */
export function changeEmailCode(to: string, code: string): Email {
	return {
		to,
		subject: `${APP_NAME} code to confirm your new email: ${code}`,
		text: [
			`Your code to make this the email address of your ${APP_NAME} account is ${code}.`,
			'',
			'The code works for 10 minutes. If you did not ask for this, ignore this email.'
		].join('\n')
	};
}

/** Sent to the old address once an account's email has changed, so a takeover is noticed. */
export function emailChangedNotice(to: string, newEmail: string): Email {
	return {
		to,
		subject: `Your ${APP_NAME} email address was changed`,
		text: [
			`The email address of your ${APP_NAME} account was changed to ${newEmail}.`,
			'This address can no longer be used to sign in to it.',
			'',
			`If you did not do this, use "Report an issue" in ${APP_NAME} to tell us.`
		].join('\n')
	};
}

export class CloudflareSender implements EmailSender {
	readonly delivery = 'email';
	constructor(
		private readonly binding: EmailBinding,
		private readonly from: string
	) {}

	async send(message: Email): Promise<void> {
		await this.binding.send({
			to: message.to,
			from: { email: this.from, name: APP_NAME },
			subject: message.subject,
			text: message.text
		});
	}
}

/** Previews and local runs: no email; what would be sent is logged (and the code shown on screen). */
export class PreviewSender implements EmailSender {
	readonly delivery = 'preview';
	async send(message: Email): Promise<void> {
		console.log(`[preview email] ${message.to}: ${message.subject}\n${message.text}`);
	}
}

/** Sign-in is off: there's no way to deliver a code. */
export class NoSender implements EmailSender {
	readonly delivery = 'unavailable';
	async send(): Promise<void> {
		throw new Error('Email sign-in is not set up yet.');
	}
}

function isLocal(url: URL): boolean {
	return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

/**
 * The sender for this request: preview mode off production, else real email when set up.
 * Local runs come first because `wrangler dev` gives them a simulated `EMAIL` binding too.
 */
export function emailSender(env: EmailEnv, url: URL): EmailSender {
	if (env.ENVIRONMENT === 'preview' || isLocal(url)) return new PreviewSender();
	if (env.EMAIL && env.EMAIL_FROM) return new CloudflareSender(env.EMAIL, env.EMAIL_FROM);
	return new NoSender();
}
