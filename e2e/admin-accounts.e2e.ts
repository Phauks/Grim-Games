import { expect, test } from '@playwright/test';
import { listedAdmin, signIn } from './admin.ts';
import { theMenu } from './shell.ts';

// Accounts (plan S27, Trevor 2026-10-30: "Accounts makes sense"): an admin finds one account by
// its exact email or username, then signs it out everywhere, removes its username or deletes it.

test('an admin finds an account and signs it out, removes its username and deletes it', async ({
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
	expect(
		(await admin.request.post('/api/admin/accounts/find', { data: { query: email } })).status()
	).toBe(404);
	await admin.goto('/accounts');
	await expect(admin.getByText('Only admin accounts see accounts.')).toBeVisible();

	await signIn(admin, listedAdmin(testInfo, 4));
	await (await theMenu(admin)).getByRole('link', { name: 'Accounts' }).tap();
	await expect(admin).toHaveURL(/\/accounts$/);
	// Nothing found yet: every row is there, as None, and the actions wait.
	await expect(admin.getByTestId('admin-account-email')).toHaveText('None');
	await expect(admin.getByRole('button', { name: 'Delete account' })).toBeDisabled();

	// By username, exactly.
	const field = admin.getByLabel('Email or username', { exact: true });
	await field.fill(name.toUpperCase());
	await admin.getByRole('button', { name: 'Find', exact: true }).tap();
	await expect(admin.getByTestId('admin-account-email')).toHaveText(email);
	await expect(admin.getByTestId('admin-account-username')).toHaveText(name);
	await expect(admin.getByTestId('admin-account-devices')).toHaveText('1');

	// Sign out everywhere: the person's device is signed out.
	await admin.getByRole('button', { name: 'Sign out everywhere' }).tap();
	await admin
		.getByRole('alertdialog', { name: 'Sign out every device?' })
		.getByRole('button', {
			name: 'Confirm'
		})
		.tap();
	await expect(admin.getByTestId('admin-account-devices')).toHaveText('0');
	const session = await page.evaluate(
		async () => (await (await fetch('/api/auth/session')).json()).user as unknown
	);
	expect(session).toBeNull();

	// Remove the username: it is free again.
	await admin.getByRole('button', { name: 'Remove username' }).tap();
	await admin
		.getByRole('alertdialog', { name: 'Remove this username?' })
		.getByRole('button', {
			name: 'Confirm'
		})
		.tap();
	await expect(admin.getByTestId('admin-account-username')).toHaveText('None');
	await field.fill(name);
	await admin.getByRole('button', { name: 'Find', exact: true }).tap();
	await expect(admin.getByText('No account has that email or username')).toBeVisible();
	await expect(admin.getByTestId('admin-account-email')).toHaveText('None');

	// By email, then delete it: it is gone.
	await field.fill(email);
	await admin.getByRole('button', { name: 'Find', exact: true }).tap();
	await expect(admin.getByTestId('admin-account-email')).toHaveText(email);
	await admin.getByRole('button', { name: 'Delete account' }).tap();
	await admin
		.getByRole('alertdialog', { name: 'Delete this account?' })
		.getByRole('button', {
			name: 'Confirm'
		})
		.tap();
	await expect(admin.getByTestId('admin-account-email')).toHaveText('None');
	await admin.getByRole('button', { name: 'Find', exact: true }).tap();
	await expect(admin.getByTestId('admin-account-email')).toHaveText('None');

	await adminContext.close();
});

test('an account that is not an admin gets no Accounts', async ({ page }, testInfo) => {
	await signIn(page, `${testInfo.project.name}-not-admin-${Date.now().toString(36)}@example.com`);
	expect(
		(
			await page.request.post('/api/admin/accounts/find', {
				data: { query: 'someone@example.com' },
				headers: { Origin: new URL(page.url()).origin }
			})
		).status()
	).toBe(404);
	await expect((await theMenu(page)).getByRole('link', { name: 'Accounts' })).toHaveCount(0);
	await page.goto('/accounts');
	await expect(page.getByText('Only admin accounts see accounts.')).toBeVisible();
});
