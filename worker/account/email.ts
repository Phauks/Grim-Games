/**
 * Sending sign-in emails, behind one interface so the real provider slots in later.
 *
 * Today there is no domain, so Cloudflare Email Service can't send to anyone yet (it only
 * sends from a domain on the account: developers.cloudflare.com/email-service/platform/limits/).
 * Until then:
 * - Previews and local runs use `PreviewSender`: nothing is sent; the code and link go to
 *   the Worker log and back to the page, which shows them on screen;
 * - production has no sender, so sign-in is switched off there.
 *
 * To turn real email on (07-accounts-and-multi-device.md §1): add the domain to Cloudflare,
 * onboard it in Email Service, then add `"send_email": [{ "name": "EMAIL" }]` and the var
 * `EMAIL_FROM` (for example `"Grim-Games <sign-in@example.com>"`) to wrangler.jsonc.
 * `CloudflareSender` is then used automatically.
 */
import type { EmailDelivery } from '../../src/lib/features/account/account-protocol.ts';

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
		from: string;
		subject: string;
		text: string;
		html?: string;
	}): Promise<{ messageId: string }>;
}

export interface EmailEnv {
	ENVIRONMENT?: string;
	EMAIL?: EmailBinding;
	EMAIL_FROM?: string;
}

function body(message: SignInEmail): string {
	return [
		`Your Grim-Games sign-in code is ${message.code}.`,
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
			from: this.from,
			subject: `Grim-Games sign-in code: ${message.code}`,
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

/** The sender for this request: real email when set up, else preview mode off production. */
export function emailSender(env: EmailEnv, url: URL): EmailSender {
	if (env.EMAIL && env.EMAIL_FROM) return new CloudflareSender(env.EMAIL, env.EMAIL_FROM);
	if (env.ENVIRONMENT === 'preview' || isLocal(url)) return new PreviewSender();
	return new NoSender();
}
