import { expect, test, type Page } from '@playwright/test';
import { openMenu, openSettingsDialog } from './shell.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';

// Local runs use the preview email sender: no email is sent and the code is shown on screen.
const homebrew = [
	{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
	'washerwoman',
	'chef',
	'saint',
	'poisoner',
	'imp'
];

// Sign-in attempts are limited per network address; each test gets its own, so the file
// doesn't run into the limit (on Cloudflare the header is always set by Cloudflare).
test.beforeEach(async ({ page }) => {
	const part = () => Math.floor(Math.random() * 254) + 1;
	await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${part()}.${part()}.${part()}` });
});

function uniqueEmail(name: string): string {
	return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** The code shown on screen by a preview build. */
async function previewCode(page: Page): Promise<string> {
	const note = page.getByTestId('preview-code');
	await expect(note).toContainText('Preview build: no email is sent');
	const code = (await note.locator('strong').textContent()) ?? '';
	expect(code).toMatch(/^\d{6}$/);
	return code;
}

/** This device signs out from its own row in Devices on the Account page (2026-10-22). */
async function signOut(page: Page) {
	await page.goto('/account');
	await page
		.getByTestId('devices-table')
		.getByRole('button', { name: /^Sign out .*\(this device\)$/ })
		.tap();
}

async function signInWithCode(page: Page, email: string, creating = true) {
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me a code' }).tap();
	await page.getByLabel(`Code sent to ${email}`).fill(await previewCode(page));
	await page.getByRole('button', { name: 'Sign in' }).tap();
	if (creating) await acceptPrivacy(page);
	await expect(page.getByTestId('account-email')).toHaveText(email);
	await expect(page.getByRole('alertdialog', { name: 'Privacy policy' })).toHaveCount(0);
}

/** A new account accepts the privacy policy before it is made (Trevor, 2026-10-18). */
async function acceptPrivacy(page: Page) {
	const dialog = page.getByRole('alertdialog', { name: 'Privacy policy' });
	await expect(dialog).toContainText('To create your account, accept the Privacy policy.');
	await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await dialog.getByText('I accept the Privacy policy', { exact: true }).tap();
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
}

test('signing in with an emailed code, then signing out', async ({ page }) => {
	const email = uniqueEmail('code');
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me a code' }).tap();
	await page.getByLabel(`Code sent to ${email}`).fill('000000');
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await expect(page.getByRole('status').filter({ hasText: 'not right' })).toBeVisible();

	// A new account waits for the privacy policy; declining leaves the code still usable.
	await page.getByLabel(`Code sent to ${email}`).fill(await previewCode(page));
	await page.getByRole('button', { name: 'Sign in' }).tap();
	const privacy = page.getByRole('alertdialog', { name: 'Privacy policy' });
	await expect(privacy.getByRole('link', { name: 'Read the Privacy policy' })).toHaveAttribute(
		'href',
		'/privacy'
	);
	await privacy.getByRole('button', { name: 'Cancel' }).tap();
	await expect(
		page.getByRole('status').filter({ hasText: 'needs the Privacy policy accepted' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await acceptPrivacy(page);
	await expect(page.getByTestId('account-email')).toHaveText(email);
	await signOut(page);
	// Accepted once: signing in again doesn't ask.
	await signInWithCode(page, email, false);
	// The session survives a reload: it's a cookie the page can't read.
	await page.reload();
	await expect(page.getByTestId('account-email')).toHaveText(email);
	expect(await page.evaluate(() => document.cookie)).not.toContain('gg_session');
	// Devices are a table; this device signs out from its own row (there is no header).
	const devices = page.getByTestId('devices-table');
	await expect(devices.getByText('(this device)')).toBeVisible();
	// A rough place per device; the local server has none from Cloudflare, so None.
	await expect(devices.getByText('Location').first()).toBeVisible();
	const own = devices.getByRole('button', { name: /^Sign out .*\(this device\)$/ });
	await expect(own).toBeEnabled();
	// Signing out is a text button, not the trash can (Trevor, 2026-10-18).
	await expect(own).toHaveText('Sign out');
	// Sign out other devices sits in the section's header; Delete account has a section of its own.
	await expect(page.getByRole('button', { name: 'Sign out other devices' })).toBeDisabled();
	await expect(page.getByRole('heading', { name: 'Delete account' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);

	await signOut(page);
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
	await acceptPrivacy(opened);
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

/** How many documents of `kind` the signed-in profile holds. */
async function profileDocCount(page: Page, kind: string): Promise<number> {
	return page.evaluate(async (kind) => {
		const { docs } = await (await fetch(`/api/account/docs/${kind}`)).json();
		return (docs as { deleted: boolean }[]).filter((doc) => !doc.deleted).length;
	}, kind);
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
	// The first sign-in on this device offers what it already has (sync plan step 2).
	const offer = page.getByRole('alertdialog', { name: "Add this device's data to your account?" });
	await expect(
		offer.getByRole('checkbox', { name: '1 script', includeHidden: true })
	).toBeChecked();
	await offer.getByRole('button', { name: 'Confirm' }).tap();
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
		(r) => r.url().endsWith('/api/account/sync') && r.request().method() === 'POST'
	);
	await again.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Second Wind');
	expect((await saving).status()).toBe(200);
	await expect.poll(() => profileScriptNames(page)).toContain('Second Wind');
});

/** Adds a pasted script in the Library. */
async function addScript(page: Page, name: string) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste
		.getByLabel('Script JSON')
		.fill(JSON.stringify([{ id: '_meta', name }, ...homebrew.slice(1)]));
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText(name);
}

const libraryRow = (page: Page, name: string) =>
	page.getByTestId('library-table').getByRole('button', { name: new RegExp(`^${name}`) });

async function scriptsSwitch(page: Page) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Data' })
		.tap();
	return {
		dialog,
		input: dialog.getByRole('checkbox', {
			name: 'Sync scripts with your account',
			includeHidden: true
		}),
		label: dialog.getByText('Sync scripts with your account', { exact: true })
	};
}

// Account sync (Storage thread's plan, Trevor 2026-10-18): one account, two devices, kept in step.
test('scripts sync between two devices, unless a device turns it off', async ({
	page,
	browser
}, testInfo) => {
	const email = uniqueEmail('sync');
	const other = await browser.newContext({ ...testInfo.project.use });
	const second = await other.newPage();
	const part = () => Math.floor(Math.random() * 254) + 1;
	await second.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${part()}.${part()}.${part()}` });

	await signInWithCode(page, email);
	await addScript(page, 'Storm Front');
	await expect.poll(() => profileScriptNames(page)).toContain('Storm Front');

	// The second device gets it when it signs in, without adding anything itself.
	await signInWithCode(second, email, false);
	await second.goto('/library');
	await expect(libraryRow(second, 'Storm Front')).toBeVisible();

	// And sends its own back.
	await addScript(second, 'Second Wind');
	await expect.poll(() => profileScriptNames(second)).toContain('Second Wind');
	await page.goto('/library');
	await expect(libraryRow(page, 'Second Wind')).toBeVisible();

	// Switched off on the second device: it no longer takes the first device's changes.
	await second.goto('/');
	const off = await scriptsSwitch(second);
	await expect(off.input).toBeChecked();
	await off.label.tap();
	await expect(off.input).not.toBeChecked();
	await addScript(page, 'Third Rain');
	await expect.poll(() => profileScriptNames(page)).toContain('Third Rain');
	await second.goto('/library');
	await expect(libraryRow(second, 'Second Wind')).toBeVisible();
	await expect(libraryRow(second, 'Third Rain')).toHaveCount(0);

	// Back on: it catches up on everything it skipped.
	const on = await scriptsSwitch(second);
	await on.label.tap();
	await expect(on.input).toBeChecked();
	await second.goto('/library');
	await expect(libraryRow(second, 'Third Rain')).toBeVisible();
	await other.close();
});

test('deleting the account signs out and removes it', async ({ page }) => {
	const email = uniqueEmail('delete');
	await signInWithCode(page, email);
	const id = (await page.getByTestId('account-id').textContent()) ?? '';
	// A labelled red button, not the trash icon (Trevor, 2026-10-18).
	await page.getByRole('button', { name: 'Delete account' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete your account?' });
	// Confirm waits for the account ID typed out (case and outer spaces don't matter).
	const field = confirm.getByLabel(`Type ${id} to confirm`);
	await expect(confirm.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await field.fill(id.slice(0, -1));
	await expect(confirm.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await field.fill(` ${id.toUpperCase()} `);
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
	await signOut(page);
	await signInWithCode(page, email);
	expect(await idOf()).not.toBe(id);
	await expect(page.getByTestId('account-username')).toHaveText('None');

	// Usernames are unique, ignoring case.
	await page.getByRole('button', { name: 'Change username' }).tap();
	await naming.getByLabel('Username').fill(name.toUpperCase());
	await naming.getByRole('button', { name: 'Confirm' }).tap();
	await expect(naming.getByRole('status')).toHaveText('That username is taken.');
});

test('Account in the menu opens the Account page, signed in or out', async ({ page }) => {
	const email = uniqueEmail('menu');
	await signInWithCode(page, email);
	await page.goto('/library');
	const account = (await openMenu(page)).getByRole('link', { name: 'Account' });
	await expect(account.getByTestId('profile-icon').locator('..')).toHaveAttribute(
		'data-signed-in',
		'true'
	);
	await account.tap();
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByTestId('account-email')).toHaveText(email);

	await signOut(page);
	await expect(page.getByLabel('Email address')).toBeVisible();
	// Signed out, the same item goes to sign-in.
	await page.goto('/library');
	await (await openMenu(page)).getByRole('link', { name: 'Account' }).tap();
	await expect(page).toHaveURL(/\/account$/);
	await expect(page.getByLabel('Email address')).toBeVisible();
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

/** The session cookie the browser holds, if any. */
async function sessionCookie(page: Page) {
	return (await page.context().cookies()).find((cookie) => cookie.name === 'gg_session');
}

test('creating an account with a password, then signing in with it', async ({ page }) => {
	// Capitals in the address are kept as typed; the account is still found ignoring case.
	const email = uniqueEmail('Create');
	const password = 'correct horse battery';
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('short');
	await page.getByRole('button', { name: 'Create account' }).tap();
	await expect(page.getByRole('status').filter({ hasText: 'A password is 10' })).toBeVisible();

	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Create account' }).tap();
	await page.getByLabel(`Code sent to ${email}`).fill(await previewCode(page));
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await acceptPrivacy(page);
	await expect(page.getByTestId('account-email')).toHaveText(email);
	await expect(page.getByTestId('account-password')).toHaveText('Set');
	// Remember me is on by default: the cookie outlives the browser.
	expect((await sessionCookie(page))?.expires).toBeGreaterThan(Date.now() / 1000 + 86400);

	await signOut(page);
	// A wrong password and an unknown address get the same answer.
	await page.getByLabel('Email address').fill(email.toLowerCase());
	await page.getByLabel('Password', { exact: true }).fill('not the password');
	const answer = async () => {
		const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/password'));
		await page.getByRole('button', { name: 'Sign in' }).tap();
		return [(await response).status(), (await (await response).json()).error];
	};
	const wrong = await answer();
	expect(wrong[0]).toBe(401);
	await expect(page.getByRole('status').filter({ hasText: 'do not match' })).toBeVisible();
	await page.getByLabel('Email address').fill(uniqueEmail('nobody'));
	expect(await answer()).toEqual(wrong);

	// Without Remember me, the cookie ends with the browser.
	await page.getByLabel('Email address').fill(email.toLowerCase());
	await page.getByLabel('Password', { exact: true }).fill(password);
	const remember = page.getByRole('checkbox', { name: 'Remember me' });
	await expect(remember).toBeChecked();
	await page.getByText('Remember me', { exact: true }).tap();
	await expect(remember).not.toBeChecked();
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await expect(page.getByTestId('account-email')).toHaveText(email);
	expect((await sessionCookie(page))?.expires).toBe(-1);
	await page.reload();
	await expect(page.getByTestId('account-email')).toHaveText(email);
	expect((await sessionCookie(page))?.expires).toBe(-1);
});

test('a code-only account can set a password in Account settings', async ({ page }) => {
	const email = uniqueEmail('later');
	await signInWithCode(page, email);
	await expect(page.getByTestId('account-password')).toHaveText('None');
	await page.getByRole('button', { name: 'Set password' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Set password' });
	await dialog.getByLabel('New password').fill('a much longer password');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('account-password')).toHaveText('Set');

	await signOut(page);
	await page.getByLabel('Email address').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('a much longer password');
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await expect(page.getByTestId('account-email')).toHaveText(email);
});

// Account has no icon row of its own (Trevor, 2026-10-30): the Profile's character token is it.
test("the Profile's character token is the account's icon on Account in the menu", async ({
	page
}) => {
	await signInWithCode(page, uniqueEmail('icon'));
	await expect(page.getByRole('button', { name: 'Change icon' })).toHaveCount(0);
	// Checks the icon on Account in the menu, then taps it, which closes the menu.
	const expectIcon = async (icon: string | undefined) => {
		const link = (await openMenu(page)).getByRole('link', { name: 'Account' });
		const shown = link.getByTestId('profile-icon');
		if (icon) await expect(shown).toHaveAttribute('data-icon', icon);
		else await expect(shown).not.toHaveAttribute('data-icon');
		await link.tap();
		await expect(page.getByRole('dialog', { name: APP_NAME })).toBeHidden();
	};
	const pickToken = async (name: RegExp | 'None') => {
		const settings = await openSettingsDialog(page);
		await settings.getByRole('button', { name: 'Profile', exact: true }).tap();
		await settings.getByRole('button', { name: 'Change character token' }).tap();
		const picker = page.getByRole('dialog', { name: 'Character token' });
		if (name === 'None') await picker.getByRole('button', { name: 'None' }).tap();
		else {
			await picker.getByRole('searchbox').fill('Fortune Teller');
			await picker.getByRole('button', { name }).first().tap();
		}
		await expect(picker).toBeHidden();
		await settings.getByRole('button', { name: 'Close' }).first().tap();
		await expect(settings).toBeHidden();
	};

	await expectIcon(undefined);
	await pickToken(/Fortune Teller/);
	await expectIcon('fortuneteller');
	// It is kept on the account too.
	await page.reload();
	await expectIcon('fortuneteller');

	await pickToken('None');
	await expectIcon(undefined);
});

// Trevor (2026-10-18): what Download my data saves, Import data reads back in.
test('a downloaded data file imports into another account, adding only what is missing', async ({
	page,
	browser
}, testInfo) => {
	await signInWithCode(page, uniqueEmail('export'));
	await addScript(page, 'Storm Front');
	await expect.poll(() => profileScriptNames(page)).toContain('Storm Front');
	await page.goto('/account');
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download my data' }).tap();
	const file = testInfo.outputPath('my-data.json');
	await (await downloading).saveAs(file);

	// Another account on another device, which has never seen the script.
	const other = await browser.newContext({ ...testInfo.project.use });
	const second = await other.newPage();
	const part = () => Math.floor(Math.random() * 254) + 1;
	await second.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${part()}.${part()}.${part()}` });
	await signInWithCode(second, uniqueEmail('import'));
	// The new account gets the device's settings profile shortly after sign-in; an import
	// planned before then counts that profile as new too (CI flake, 2026-10-26 and 27).
	await expect.poll(() => profileDocCount(second, 'settings-profile')).toBe(1);
	const importOnce = async () => {
		await second.locator('input[type="file"][aria-label="Import data"]').setInputFiles(file);
		return second.getByRole('alertdialog', { name: 'Import data' });
	};
	let dialog = await importOnce();
	const plan = dialog.getByTestId('import-plan');
	await expect(plan.getByRole('row', { name: 'Items to add' })).toContainText('1');
	// Each account starts with the device's settings profile (plan S18); both are the same
	// untouched "My settings", so that one is already there.
	await expect(plan.getByRole('row', { name: 'Already in your account' })).toContainText('1');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect.poll(() => profileScriptNames(second)).toEqual(['Storm Front']);

	// The same file again has nothing to add.
	dialog = await importOnce();
	await expect(plan.getByRole('row', { name: 'Already in your account' })).toContainText('2');
	await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await other.close();
});
