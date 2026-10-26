import { expect, type Page, type TestInfo } from '@playwright/test';

/** Signs in with a code, as the local server shows it on screen. */
export async function signIn(page: Page, email: string) {
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me a code' }).tap();
	const code = (await page.getByTestId('preview-code').locator('strong').textContent()) ?? '';
	await page.getByLabel(`Code sent to ${email}`).fill(code);
	await page.getByRole('button', { name: 'Sign in' }).tap();
	// A new account accepts the privacy policy first; a local server reused between runs
	// already has the admin accounts.
	const privacy = page.getByRole('alertdialog', { name: 'Privacy policy' });
	const signedIn = page.getByTestId('account-email');
	await expect(privacy.or(signedIn).first()).toBeVisible();
	if (await privacy.isVisible()) {
		await privacy.getByText('I accept the Privacy policy', { exact: true }).tap();
		await privacy.getByRole('button', { name: 'Confirm' }).tap();
	}
	await expect(signedIn).toHaveText(email);
}

/**
 * An admin from the start, named in ADMIN_EMAILS like Trevor in Cloudflare (playwright.config.ts).
 * One per test and project, since tests run in parallel and a new code replaces the last.
 */
export function listedAdmin(testInfo: TestInfo, n: 1 | 2 | 3): string {
	return `${testInfo.project.name}-admin-${n}@example.com`;
}
