import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Send code' }).tap();
	const code = (await page.getByTestId('preview-code').locator('strong').textContent()) ?? '';
	await page.getByLabel(`Code sent to ${email}`).fill(code);
	await page.getByRole('button', { name: 'Sign in' }).tap();
	await expect(page.getByTestId('account-email')).toHaveText(email);
}

test('a report sent from the footer reaches the inbox, where it can be triaged and deleted', async ({
	page
}) => {
	const title = `Enhancement ${Date.now()}`;
	await page.goto('/');
	await page.getByTestId('build-info').getByRole('button', { name: 'Report an issue' }).tap();
	const form = page.getByRole('dialog', { name: 'Report' });

	// Nothing is sent until Send, which waits for a title and a description.
	const send = form.getByRole('button', { name: 'Confirm' });
	await expect(send).toBeDisabled();
	await form.getByRole('combobox', { name: 'Kind' }).tap();
	await page.getByRole('option', { name: 'Enhancement request' }).tap();
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	await form.getByRole('textbox', { name: 'Description' }).fill('Show the night order on phones.');
	// What goes with it is listed before sending.
	await form.getByRole('button', { name: 'Sent with it' }).tap();
	await expect(form).toContainText('Build');
	expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await send.tap();
	await expect(form.getByTestId('report-sent')).toHaveText(/^Sent as report #\d+\.$/);
	await form.getByRole('button', { name: 'Close' }).last().tap();

	// The inbox needs the admin key, kept on this device.
	await page.goto('/reports');
	// The title row's buttons and the filter are there before the key, disabled, so nothing moves.
	await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Forget key' })).toBeDisabled();
	const key = page.getByLabel('Admin key');
	await key.fill('wrong');
	await key.press('Enter');
	await expect(page.getByLabel('Wrong key')).toBeVisible();
	await page.getByLabel('Wrong key').fill('e2e-admin-key');
	await page.getByLabel('Wrong key').press('Enter');

	const row = page.getByTestId('reports').getByRole('button', { name: new RegExp(title) });
	await expect(row).toContainText('Enhancement request');
	await row.tap();
	const report = page.getByRole('dialog', { name: new RegExp(title) });
	await expect(report).toContainText('Show the night order on phones.');
	await report.getByRole('combobox', { name: 'Status' }).tap();
	await page.getByRole('option', { name: 'Accepted' }).tap();
	await report.getByRole('button', { name: 'Close' }).first().tap();
	// Filtered to New by default, so an accepted report leaves the list.
	await expect(row).toBeHidden();
	await expect(report).toBeHidden();
	await page.getByRole('combobox', { name: 'Status' }).tap();
	await page.getByRole('option', { name: 'Accepted', exact: true }).tap();
	await expect(row).toBeVisible();

	// The key is remembered; delete confirms first.
	await page.reload();
	await page.getByRole('combobox', { name: 'Status' }).tap();
	await page.getByRole('option', { name: 'All', exact: true }).tap();
	await row.tap();
	await page.getByRole('button', { name: 'Delete report' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(row).toBeHidden();
});

test('reading reports without the key is refused', async ({ request }) => {
	expect((await request.get('/api/reports')).status()).toBe(404);
	const bad = await request.post('/api/reports', { data: { kind: 'spam', title: 'x', body: 'y' } });
	expect(bad.status()).toBe(400);
});

test('an admin account opens the inbox without the key; the key holder names admins', async ({
	page,
	browser
}) => {
	const email = `admin-${Date.now()}@example.com`;
	// The key holder adds the first admin from the Admins list. Only an existing account can
	// be named: admins are stored by account id, so the email can change later.
	await page.goto('/reports');
	await page.getByLabel('Admin key').fill('e2e-admin-key');
	await page.getByLabel('Admin key').press('Enter');
	await page.getByRole('button', { name: 'Admins' }).tap();
	const admins = page.getByRole('dialog', { name: 'Admins' });
	await admins.getByLabel('Add an admin by sign-in email').fill(email);
	await admins.getByLabel('Add an admin by sign-in email').press('Enter');
	await expect(admins.getByLabel('No account signs in with that email')).toBeVisible();

	// On another device, that person signs in once.
	const other = await browser.newContext();
	const phone = await other.newPage();
	await signIn(phone, email);
	await admins.getByLabel('No account signs in with that email').press('Enter');
	await expect(admins.getByTestId('admins')).toContainText(email);
	await expect(admins.getByLabel('Add an admin by sign-in email')).toHaveValue('');

	// Now their account opens the inbox with no key prompt.
	await phone.goto('/reports');
	await expect(phone.getByTestId('reports')).toBeVisible();
	await expect(phone.getByLabel('Admin key')).toBeHidden();
	await expect(phone.getByRole('button', { name: 'Forget key' })).toBeDisabled();

	// Removing the admin closes the inbox to that account again.
	await admins.getByRole('button', { name: `Remove admin ${email}` }).tap();
	await expect(admins.getByTestId('admins')).not.toContainText(email);
	await phone.reload();
	await expect(phone.getByLabel('Admin key')).toBeVisible();
	await other.close();
});

test('a signed-in account that is not an admin is refused', async ({ page }) => {
	await signIn(page, `not-admin-${Date.now()}@example.com`);
	expect((await page.request.get('/api/reports')).status()).toBe(404);
	expect((await page.request.get('/api/reports/admins')).status()).toBe(404);
});
