import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';

/** An admin from the start (playwright.config.ts), as the first one added in the database. */
const FIRST_ADMIN = 'first-admin@example.com';

async function signIn(page: Page, email: string) {
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me a code' }).tap();
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

	// The inbox is for admins only. There is no key to type.
	await page.goto('/reports');
	await expect(page.getByText('Only admins can read reports.')).toBeVisible();
	// The title row's buttons and the filter are there, disabled, so nothing moves.
	await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Admins' })).toBeDisabled();
	await signIn(page, FIRST_ADMIN);
	await page.goto('/reports');

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

	// Delete confirms first.
	await page.reload();
	await page.getByRole('combobox', { name: 'Status' }).tap();
	await page.getByRole('option', { name: 'All', exact: true }).tap();
	await row.tap();
	await page.getByRole('button', { name: 'Delete report' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(row).toBeHidden();
});

test('reading reports signed out is refused', async ({ request }) => {
	expect((await request.get('/api/reports')).status()).toBe(404);
	const bad = await request.post('/api/reports', { data: { kind: 'spam', title: 'x', body: 'y' } });
	expect(bad.status()).toBe(400);
});

test('an admin names another admin, whose account then opens the inbox', async ({
	page,
	browser
}) => {
	const email = `admin-${Date.now()}@example.com`;
	// An admin adds another from the Admins list. Only an existing account can be named:
	// admins are stored by account id, so the email can change later.
	await signIn(page, FIRST_ADMIN);
	await page.goto('/reports');
	await page.getByRole('button', { name: 'Admins' }).tap();
	const admins = page.getByRole('dialog', { name: 'Admins' });
	await admins.getByLabel('Add an admin by sign-in email').fill(email);
	await admins.getByLabel('Add an admin by sign-in email').press('Enter');
	await expect(admins.getByLabel('No account signs in with that email')).toBeVisible();

	// On another device, that person signs in once.
	const other = await browser.newContext();
	const phone = await other.newPage();
	await signIn(phone, email);
	// New accounts get a word-chain id (five words joined by "-"); admins are stored by it.
	const session = await phone.evaluate(async () => (await fetch('/api/auth/session')).json());
	expect(session.user.id).toMatch(/^[a-z]+(-[a-z]+){4}$/);
	await admins.getByLabel('No account signs in with that email').press('Enter');
	await expect(admins.getByTestId('admins')).toContainText(email);
	await expect(admins.getByLabel('Add an admin by sign-in email')).toHaveValue('');

	// Their account is now an Admin, with Reports in the menu (Trevor, 2026-10-18).
	await phone.goto('/account');
	await expect(phone.getByTestId('account-type')).toHaveText('Admin');
	await phone.getByRole('banner').getByRole('button', { name: 'Menu', exact: true }).tap();
	await phone.getByRole('dialog', { name: APP_NAME }).getByRole('link', { name: 'Reports' }).tap();
	await expect(phone).toHaveURL(/\/reports$/);

	// Now their account opens the inbox.
	await phone.goto('/reports');
	await expect(phone.getByTestId('reports')).toBeVisible();

	// Removing the admin closes the inbox to that account again.
	await admins.getByRole('button', { name: `Remove admin ${email}` }).tap();
	await expect(admins.getByTestId('admins')).not.toContainText(email);
	await phone.reload();
	await expect(phone.getByText('Only admins can read reports.')).toBeVisible();
	await other.close();
});

test('a signed-in account that is not an admin is refused', async ({ page }) => {
	await signIn(page, `not-admin-${Date.now()}@example.com`);
	await expect(page.getByTestId('account-type')).toHaveText('User');
	await page.getByRole('banner').getByRole('button', { name: 'Menu', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: APP_NAME });
	await expect(menu.getByRole('link', { name: 'Library' })).toBeVisible();
	await expect(menu.getByRole('link', { name: 'Reports' })).toHaveCount(0);
	expect((await page.request.get('/api/reports')).status()).toBe(404);
	expect((await page.request.get('/api/reports/admins')).status()).toBe(404);
});
