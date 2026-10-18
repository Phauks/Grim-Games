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

/** Names of the scripts saved to the signed-in profile. */
async function profileScriptNames(page: Page): Promise<string[]> {
	return page.evaluate(async () => {
		const { docs } = await (await fetch('/api/account/docs/script')).json();
		return (docs as { deleted: boolean; body?: { name?: string } }[])
			.filter((doc) => !doc.deleted)
			.map((doc) => doc.body?.name ?? '');
	});
}

// Scripts are managed in the Library (Trevor, 2026-10-18); the profile keeps them in sync.
test('scripts added on the device are saved to the profile', async ({ page }) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(JSON.stringify(homebrew));
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Storm Front');

	await signInWithCode(page, uniqueEmail('scripts'));
	await expect.poll(() => profileScriptNames(page)).toContain('Storm Front');
	// The Account page no longer lists scripts.
	await expect(page.getByTestId('profile-scripts')).toHaveCount(0);

	// Adding a script while signed in saves it straight away.
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const again = page.getByRole('dialog', { name: 'Add script' });
	await again
		.getByLabel('Script JSON')
		.fill(JSON.stringify([{ id: '_meta', name: 'Second Wind' }, ...homebrew.slice(1)]));
	const saving = page.waitForResponse(
		(r) => r.url().includes('/api/account/docs/script/') && r.request().method() === 'PUT'
	);
	await again.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Second Wind');
	expect((await saving).status()).toBe(200);
	await expect.poll(() => profileScriptNames(page)).toContain('Second Wind');
});

test('deleting the account signs out and removes it', async ({ page }) => {
	const email = uniqueEmail('delete');
	await signInWithCode(page, email);
	await page.getByRole('button', { name: 'Delete account' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete your account?' });
	// Confirm waits for the email (no username yet) typed out.
	await expect(confirm.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await confirm.getByLabel(`Type ${email} to confirm`).fill(email.slice(0, -1));
	await expect(confirm.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await confirm.getByLabel(`Type ${email} to confirm`).fill(email);
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

test('the account id is a chain of words that stays when the username and email change', async ({
	page
}) => {
	const email = uniqueEmail('change');
	await signInWithCode(page, email);
	const idOf = () =>
		page.evaluate(async () => (await (await fetch('/api/auth/session')).json()).user.id as string);
	const id = await idOf();
	expect(id).toMatch(/^[a-z]+(-[a-z]+){4}$/);
	// Shown on the page, with no way to edit it.
	await expect(page.getByTestId('account-id')).toHaveText(id);
	await expect(page.getByRole('button', { name: 'Copy account ID' })).toBeVisible();
	await expect(page.getByTestId('account-username')).toHaveText('None');

	// A unique username, changed at any time.
	const name = `ann${Date.now().toString(36)}`;
	await page.getByRole('button', { name: 'Change username' }).tap();
	const naming = page.getByRole('dialog', { name: 'Change username' });
	await naming.getByLabel('Username').fill(name);
	await naming.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('account-username')).toHaveText(name);

	// A new email: a code goes to the new address, then the account moves to it.
	const next = uniqueEmail('moved');
	await page.getByRole('button', { name: 'Change email' }).tap();
	const moving = page.getByRole('dialog', { name: 'Change email' });
	await moving.getByLabel('New email address').fill(next);
	await moving.getByRole('button', { name: 'Send code' }).tap();
	await expect(moving.getByTestId('change-email-preview')).toContainText('Your code is');
	const code = /(\d{6})/.exec(
		(await moving.getByTestId('change-email-preview').textContent()) ?? ''
	)![1];
	await moving.getByLabel(`Code sent to ${next}`).fill(code);
	await moving.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('account-email')).toHaveText(next);
	expect(await idOf()).toBe(id);
	await expect(page.getByTestId('account-id')).toHaveText(id);

	// The old address no longer signs in to this account: it makes a new one.
	await page.getByRole('button', { name: 'Sign out', exact: true }).first().tap();
	await signInWithCode(page, email);
	expect(await idOf()).not.toBe(id);
	await expect(page.getByTestId('account-username')).toHaveText('None');

	// Usernames are unique, ignoring case.
	await page.getByRole('button', { name: 'Change username' }).tap();
	await naming.getByLabel('Username').fill(name.toUpperCase());
	await naming.getByRole('button', { name: 'Confirm' }).tap();
	await expect(naming.getByRole('status')).toHaveText('That username is taken.');
});

test('the header account button shows who is signed in, with settings and sign out', async ({
	page
}) => {
	const email = uniqueEmail('header');
	await signInWithCode(page, email);
	await page.goto('/library');
	await page.getByRole('button', { name: `Account: signed in as ${email}` }).tap();
	const card = page.getByTestId('account-card');
	await expect(card).toContainText(email);
	await page.getByRole('button', { name: 'Account settings' }).tap();
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByTestId('account-email')).toHaveText(email);

	await page.getByRole('button', { name: `Account: signed in as ${email}` }).tap();
	await page.getByRole('button', { name: 'Sign out', exact: true }).last().tap();
	await expect(page.getByLabel('Email address')).toBeVisible();
	// Signed out, the same button goes to sign-in.
	await page.goto('/library');
	await page.getByRole('button', { name: 'Account', exact: true }).tap();
	await expect(page).toHaveURL(/\/account$/);
});

test('my data downloads with the account name and the time in its file name', async ({ page }) => {
	await signInWithCode(page, uniqueEmail('export'));
	const id = await page.getByTestId('account-id').textContent();
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download my data' }).tap();
	expect((await download).suggestedFilename()).toMatch(
		new RegExp(`^grimbinder-${id}-\\d{4}-\\d{2}-\\d{2}-\\d{4}\\.json$`)
	);
});
