import { expect, test, type Page } from '@playwright/test';

// The Library's folders, tags, names and character collections follow a signed-in account
// (account sync, Library and Accounts threads, 2026-10-18). Local runs use the preview email
// sender, which shows the sign-in code on screen.

const ip = () => {
	const part = () => Math.floor(Math.random() * 254) + 1;
	return `10.${part()}.${part()}.${part()}`;
};

test.beforeEach(async ({ page }) => {
	await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip() });
});

async function signIn(page: Page, email: string, creating: boolean) {
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me a code' }).tap();
	const note = page.getByTestId('preview-code');
	await expect(note).toContainText('Preview build: no email is sent');
	const code = (await note.locator('strong').textContent()) ?? '';
	await page.getByLabel(`Code sent to ${email}`).fill(code);
	await page.getByRole('button', { name: 'Sign in' }).tap();
	if (creating) {
		const dialog = page.getByRole('alertdialog', { name: 'Privacy policy' });
		await dialog.getByText('I accept the Privacy policy', { exact: true }).tap();
		await dialog.getByRole('button', { name: 'Confirm' }).tap();
	}
	await expect(page.getByTestId('account-email')).toHaveText(email);
}

const row = (page: Page, name: string) =>
	page.getByTestId('library-table').getByRole('button', { name: new RegExp(`^${name}`) });

async function newFolder(page: Page, name: string) {
	await page.getByRole('button', { name: 'New folder' }).tap();
	const dialog = page.getByRole('dialog', { name: 'New folder' });
	await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
	await dialog.getByRole('textbox', { name: 'Name' }).press('Enter');
	await expect(row(page, name)).toBeVisible();
}

/** Opens the Library again until another device's change has arrived. */
async function eventually(page: Page, check: () => Promise<void>) {
	await expect(async () => {
		await page.goto('/library');
		await check();
	}).toPass({ timeout: 20_000 });
}

test('Library folders and collections follow the account to another device', async ({
	page,
	browser
}, testInfo) => {
	// Two devices, each signing in and waiting for the other.
	test.setTimeout(120_000);
	const email = `library-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
	const other = await browser.newContext({ ...testInfo.project.use });
	const second = await other.newPage();
	await second.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip() });

	// Made before signing in: it joins the account at the first sign-in.
	await page.goto('/library');
	await newFolder(page, 'Club night');
	await signIn(page, email, true);
	// The Library joins the account when it is next open.
	await page.goto('/library');
	await expect(row(page, 'Club night')).toBeVisible();

	// The other device had its own folder; signing in keeps both.
	await second.goto('/library');
	await newFolder(second, 'Teensy');
	await signIn(second, email, false);
	await eventually(second, async () => {
		await expect(row(second, 'Club night')).toBeVisible({ timeout: 2000 });
		await expect(row(second, 'Teensy')).toBeVisible();
	});
	await eventually(page, () => expect(row(page, 'Teensy')).toBeVisible({ timeout: 2000 }));

	// A collection made on one device shows on the other.
	await page.getByRole('button', { name: 'New collection' }).tap();
	const naming = page.getByRole('dialog', { name: 'New collection' });
	await naming.getByRole('textbox', { name: 'Name' }).fill('Night picks');
	await naming.getByRole('textbox', { name: 'Name' }).press('Enter');
	await eventually(second, () => expect(row(second, 'Night picks')).toBeVisible({ timeout: 2000 }));

	// And a folder deleted on one is gone from the other.
	await row(second, 'Teensy').tap();
	await second.getByRole('button', { name: 'Delete Teensy' }).tap();
	await second.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await eventually(page, () => expect(row(page, 'Teensy')).toHaveCount(0, { timeout: 2000 }));
	await expect(row(page, 'Club night')).toBeVisible();
	await other.close();
});
