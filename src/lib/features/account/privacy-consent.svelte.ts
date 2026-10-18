/**
 * Accepting the privacy policy before signing in (Trevor, 2026-10-18: "when creating an
 * account, require a user to accept the privacy policy"). The server answers a sign-in that
 * needs it with `PrivacyRequired`; `withPrivacyConsent` then asks in `PrivacyConsent.svelte`
 * and, once accepted, sends the same request again with the accepted version.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import { AccountApiError } from './account-api.ts';
import { isPrivacyRequired } from './account-protocol.ts';

interface Question {
	creating: boolean;
	answer: (accepted: boolean) => void;
}

let question = $state<Question | undefined>(undefined);

export const privacyConsent = {
	/** What the dialog is asking now, if anything. */
	get question(): Question | undefined {
		return question;
	},
	answer(accepted: boolean): void {
		const asked = question;
		question = undefined;
		asked?.answer(accepted);
	}
};

function ask(creating: boolean): Promise<boolean> {
	question?.answer(false);
	return new Promise((resolve) => (question = { creating, answer: resolve }));
}

/** Runs a sign-in, asking for the privacy policy first when the server says it is needed. */
export async function withPrivacyConsent<T>(signIn: (accepted?: string) => Promise<T>): Promise<T> {
	try {
		return await signIn();
	} catch (e) {
		if (!(e instanceof AccountApiError && e.status === 403 && isPrivacyRequired(e.body))) throw e;
		const { version, creating } = e.body.privacy;
		if (!(await ask(creating))) throw new Error(t('account.privacy.declined'), { cause: e });
		return signIn(version);
	}
}
