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

export interface SignInEmail {
	to: string;
	code: string;
	link: string;
}

export interface EmailSender {
	readonly delivery: EmailDelivery;
	send(message: SignInEmail): Promise<void>;
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

function body(message: SignInEmail): string {
	return [
		`Your ${APP_NAME} sign-in code is ${message.code}.`,
		'',
		`Or open this link on the device you are signing in on:`,
		message.link,
		'',
		'The code and link work for 10 minutes. If you did not ask to sign in, ignore this email.'
	].join('\n');
}

export class CloudflareSender implements EmailSender {
	readonly delivery = 'email';
	constructor(
		private readonly binding: EmailBinding,
		private readonly from: string
	) {}

	async send(message: SignInEmail): Promise<void> {
		await this.binding.send({
			to: message.to,
			from: { email: this.from, name: APP_NAME },
			subject: `${APP_NAME} sign-in code: ${message.code}`,
			text: body(message)
		});
	}
}

/** Previews and local runs: no email; the code is logged and shown on screen. */
export class PreviewSender implements EmailSender {
	readonly delivery = 'preview';
	async send(message: SignInEmail): Promise<void> {
		console.log(`[preview sign-in] ${message.to}: code ${message.code}, link ${message.link}`);
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
