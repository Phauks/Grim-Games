import { expect, test } from '@playwright/test';
import { listedAdmin, signIn } from './admin.ts';
import { theMenu } from './shell.ts';

// Accounts (plan S27, Trevor 2026-10-30: "accounts should allow seeing all accounts as a base,
// and clicking into an account opens a modal for the details"): an admin sees every account,
// opens one, then signs it out everywhere, removes its username or deletes it.

test('an admin sees every account, opens one and signs it out, removes its username and deletes it', async ({
	page,
	browser
}, testInfo) => {
	// Someone's account, with a username.
	const email = `${testInfo.project.name}-accounts-${Date.now().toString(36)}@example.com`;
	const name = `acc${Date.now().toString(36)}`;
	await signIn(page, email);
	await page.getByRole('button', { name: 'Change username' }).tap();
	const naming = page.getByRole('dialog', { name: 'Change username' });
	await naming.getByLabel('Username').fill(name);
	await naming.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('account-username')).toHaveText(name);

	const adminContext = await browser.newContext({ ...testInfo.project.use });
	const admin = await adminContext.newPage();
	// Signed out, the routes are not there at all, and the page says who it is for.
	expect((await admin.request.post('/api/admin/accounts/list', { data: {} })).status()).toBe(404);
	await admin.goto('/accounts');
	await expect(admin.getByText('Only admin accounts see accounts.')).toBeVisible();

	const adminEmail = listedAdmin(testInfo, 4);
	await signIn(admin, adminEmail);
	await (await theMenu(admin)).getByRole('link', { name: 'Accounts' }).tap();
	await expect(admin).toHaveURL(/\/accounts$/);
	// Every account is listed with nothing typed, the admin's own as well.
	const list = admin.getByTestId('admin-accounts');
	await expect(list.getByRole('button', { name: adminEmail })).toBeVisible();
	await expect(list.getByRole('button', { name: email })).toBeVisible();

	// The filter narrows the list by any part of a username.
	const filter = admin.getByLabel('Email, username or id', { exact: true });
	await filter.fill(name.slice(1).toUpperCase());
	await expect(list.getByRole('button')).toHaveCount(1);
	await list.getByRole('button', { name: email }).tap();
	const details = admin.getByRole('dialog', { name: email });
	await expect(details.getByTestId('admin-account-email')).toHaveText(email);
	await expect(details.getByTestId('admin-account-username')).toHaveText(name);
	await expect(details.getByTestId('admin-account-devices')).toHaveText('1');

	// Sign out everywhere: the person's device is signed out.
	await details.getByRole('button', { name: 'Sign out everywhere' }).tap();
	await admin
		.getByRole('alertdialog', { name: 'Sign out every device?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(details.getByTestId('admin-account-devices')).toHaveText('0');
	const session = await page.evaluate(
		async () => (await (await fetch('/api/auth/session')).json()).user as unknown
	);
	expect(session).toBeNull();

	// Remove the username.
	await details.getByRole('button', { name: 'Remove username' }).tap();
	await admin
		.getByRole('alertdialog', { name: 'Remove this username?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(details.getByTestId('admin-account-username')).toHaveText('None');

	// Delete it: it leaves the list.
	await details.getByRole('button', { name: 'Delete account' }).tap();
	await admin
		.getByRole('alertdialog', { name: 'Delete this account?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(details).toBeHidden();
	await filter.fill(email);
	await expect(admin.getByTestId('admin-accounts-none')).toHaveText('None');
	await admin.reload();
	await expect(
		admin.getByTestId('admin-accounts').getByRole('button', { name: adminEmail })
	).toBeVisible();
	await expect(admin.getByRole('button', { name: email })).toHaveCount(0);

	await adminContext.close();
});

test('an account that is not an admin gets no Accounts', async ({ page }, testInfo) => {
	await signIn(page, `${testInfo.project.name}-not-admin-${Date.now().toString(36)}@example.com`);
	expect(
		(
			await page.request.post('/api/admin/accounts/list', {
				data: {},
				headers: { Origin: new URL(page.url()).origin }
			})
		).status()
	).toBe(404);
	await expect((await theMenu(page)).getByRole('link', { name: 'Accounts' })).toHaveCount(0);
	await page.goto('/accounts');
	await expect(page.getByText('Only admin accounts see accounts.')).toBeVisible();
});
