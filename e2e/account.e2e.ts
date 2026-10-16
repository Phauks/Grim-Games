import { expect, test, type Page } from '@playwright/test';

// Local runs use the preview email sender: no email is sent and the code is shown on screen.
const homebrew = [
	{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
	'washerwoman',
	'chef',
	'saint',
	'poisoner',
	'imp'
];

function uniqueEmail(name: string): string {
	return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signInWithCode(page: Page, email: string) {
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Send code' }).tap();
	const note = page.getByTestId('preview-code');
	await expect(note).toContainText('Preview build: no email is sent');
	const code = (await note.locator('strong').textContent()) ?? '';
	expect(code).toMatch(/^\d{6}$/);
	await page.getByLabel(`Code sent to ${email}`).fill(code);
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await expect(page.getByTestId('account-email')).toHaveText(email);
}

test('signing in with an emailed code, then signing out', async ({ page }) => {
	const email = uniqueEmail('code');
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Send code' }).tap();
	await page.getByLabel(`Code sent to ${email}`).fill('000000');
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await expect(page.getByRole('status').filter({ hasText: 'not right' })).toBeVisible();

	await page.getByRole('button', { name: 'Change email' }).tap();
	await signInWithCode(page, email);
	// The session survives a reload: it's a cookie the page can't read.
	await page.reload();
	await expect(page.getByTestId('account-email')).toHaveText(email);
	expect(await page.evaluate(() => document.cookie)).not.toContain('gg_session');
	await expect(page.getByText('(this device)')).toBeVisible();

	await page.getByRole('button', { name: 'Sign out', exact: true }).first().tap();
	await expect(page.getByLabel('Email address')).toBeVisible();
});

test('a sign-in link signs in and keeps its token out of the address', async ({
	page,
	context
}) => {
	const email = uniqueEmail('link');
	await page.goto('/account');
	const link = await page.evaluate(async (address) => {
		const response = await fetch('/api/auth/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: address })
		});
		return (await response.json()).preview.link as string;
	}, email);
	expect(new URL(link).search).toBe('');
	// Like tapping the link in an email: it opens in a new tab of the same browser.
	const opened = await context.newPage();
	await opened.goto(link);
	await expect(opened.getByTestId('account-email')).toHaveText(email);
	expect(opened.url()).not.toContain('signin=');
});

test('scripts added on the device are saved to the profile as local copies', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Paste', exact: true }).tap();
	const paste = page.getByRole('dialog', { name: 'Paste a script' });
	await paste.getByLabel('Script JSON or link').fill(JSON.stringify(homebrew));
	await paste.getByRole('button', { name: 'Save' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Storm Front');

	await signInWithCode(page, uniqueEmail('scripts'));
	const list = page.getByTestId('profile-scripts');
	await expect(list).toContainText('Storm Front');
	await expect(list).toContainText('Local copy');

	await list.getByRole('button', { name: /Storm Front/ }).tap();
	const dialog = page.getByRole('dialog', { name: 'Storm Front' });
	await expect(dialog).toContainText('Pasted');
	// A local copy has no online version to check or unlink from.
	await expect(dialog.getByRole('button', { name: 'Check for update' })).toBeDisabled();
	await expect(dialog.getByRole('button', { name: 'Unlink' })).toBeDisabled();
	for (const button of await dialog.getByRole('button').all()) {
		const box = await button.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	}
	await dialog.getByRole('button', { name: 'Remove' }).tap();
	await expect(
		page.getByText('None. Scripts you add on the Scripts page are saved here.')
	).toBeVisible();

	// Removed from the profile, not from the device.
	await page.reload();
	await expect(
		page.getByText('None. Scripts you add on the Scripts page are saved here.')
	).toBeVisible();

	// Adding a script while signed in saves it straight away.
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Paste', exact: true }).tap();
	const again = page.getByRole('dialog', { name: 'Paste a script' });
	await again
		.getByLabel('Script JSON or link')
		.fill(JSON.stringify([{ id: '_meta', name: 'Second Wind' }, ...homebrew.slice(1)]));
	const saving = page.waitForResponse(
		(r) => r.url().includes('/api/account/docs/script/') && r.request().method() === 'PUT'
	);
	await again.getByRole('button', { name: 'Save' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Second Wind');
	expect((await saving).status()).toBe(200);
	await page.goto('/account');
	await expect(page.getByTestId('profile-scripts')).toContainText('Second Wind');
	await expect(page.getByTestId('profile-scripts')).not.toContainText('Storm Front');
});

test('deleting the account signs out and removes it', async ({ page }) => {
	const email = uniqueEmail('delete');
	await signInWithCode(page, email);
	await page.getByRole('button', { name: 'Delete account' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete your account?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByLabel('Email address')).toBeVisible();
	const session = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
	expect(session.user).toBeNull();
});

test('account changes are refused from other sites', async ({ page }) => {
	await page.goto('/account');
	const status = await page.evaluate(async () => {
		// A form post from another site arrives without a JSON body.
		const response = await fetch('/api/account', { method: 'DELETE' });
		return response.status;
	});
	expect(status).toBe(403);
});
