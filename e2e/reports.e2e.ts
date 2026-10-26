import { expect, test } from '@playwright/test';
import { listedAdmin, signIn } from './admin.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { pickScript, toBoard } from './new-game.ts';
import { menuButton, theMenu } from './shell.ts';

test('a report sent from the menu reaches the inbox, where it can be triaged and deleted', async ({
	page
}, testInfo) => {
	const title = `Enhancement ${Date.now()}`;
	await page.goto('/');
	await (await theMenu(page)).getByRole('button', { name: 'Report an issue' }).tap();
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

	// Signed out, the inbox only offers to sign in; there is no admin key (Trevor, 2026-10-22).
	await page.goto('/reports');
	// Refresh is there before signing in, disabled, so nothing moves; Admins is only for admins.
	await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Admins' })).toBeHidden();
	await expect(page.getByLabel('Admin key')).toHaveCount(0);
	await page.getByRole('main').getByRole('button', { name: 'Sign in' }).tap();
	await expect(page).toHaveURL(/\/account$/);
	await signIn(page, listedAdmin(testInfo, 1));
	await page.goto('/reports');

	// One table: every column filters (Trevor, 2026-10-18); a tap anywhere on a row opens it.
	const table = page.getByTestId('reports');
	const row = table.locator('tr', { hasText: title });
	await expect(row).toContainText('Enhancement request');
	// Sent signed out: no account to show.
	await expect(row).toContainText('Signed out');
	await row.getByRole('button', { name: title }).tap();
	const report = page.getByRole('dialog', { name: new RegExp(title) });
	await expect(report).toContainText('Show the night order on phones.');
	await report.getByRole('combobox', { name: 'Status' }).tap();
	await page.getByRole('option', { name: 'Accepted' }).tap();
	await report.getByRole('button', { name: 'Close' }).first().tap();
	// Admins start filtered to New, so an accepted report leaves the list.
	await expect(row).toBeHidden();
	await expect(report).toBeHidden();
	await table.getByRole('button', { name: 'Filter Status (set)' }).tap();
	const status = page.getByRole('dialog', { name: 'Filter Status' });
	// New may have no rows left: unticked, it leaves the list, so it is tapped, not unchecked.
	await status.getByLabel('New').click();
	await status.getByLabel('Accepted').check();
	await status.getByRole('button', { name: 'Close' }).tap();
	await expect(row).toBeVisible();

	// Still an admin after a reload; delete confirms first.
	await page.reload();
	await table.getByRole('button', { name: 'Filter Status (set)' }).tap();
	await status.getByLabel('New').click();
	await status.getByRole('button', { name: 'Close' }).tap();
	await row.getByRole('button', { name: title }).tap();
	await page.getByRole('button', { name: 'Delete report' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(row).toBeHidden();
});

test('reading reports signed out is refused', async ({ request }) => {
	expect((await request.get('/api/reports')).status()).toBe(404);
	const bad = await request.post('/api/reports', { data: { kind: 'spam', title: 'x', body: 'y' } });
	expect(bad.status()).toBe(400);
});

test('an account in ADMIN_EMAILS is an admin, with nothing to manage on Reports', async ({
	page
}, testInfo) => {
	// Admin is inherent by user type (Trevor, 2026-10-22): no Admins list, no Only mine.
	await signIn(page, listedAdmin(testInfo, 2));
	await expect(page.getByTestId('account-type')).toHaveText('Admin');
	// Admins have Reports in the menu (Trevor, 2026-10-18).
	await menuButton(page).tap();
	await page.getByRole('dialog', { name: APP_NAME }).getByRole('link', { name: 'Reports' }).tap();
	await expect(page).toHaveURL(/\/reports$/);
	await expect(page.getByTestId('reports')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Admins' })).toHaveCount(0);
	await expect(page.getByText('Only mine', { exact: true })).toHaveCount(0);
	// The old admin list API is gone.
	expect((await page.request.get('/api/reports/admins')).status()).toBe(404);
});

test('a signed-in account that is not an admin reads reports but cannot triage them', async ({
	page,
	browser
}) => {
	// Sent while signed in: stored with the account (Trevor, 2026-10-19: filter by user).
	const sender = `sender-${Date.now()}@example.com`;
	const title = `Signed in ${Date.now()}`;
	await signIn(page, sender);
	await page.goto('/');
	await (await theMenu(page)).getByRole('button', { name: 'Report an issue' }).tap();
	const form = page.getByRole('dialog', { name: 'Report' });
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	await form.getByRole('textbox', { name: 'Description' }).fill('The bag forgets the Drunk.');
	await form.getByRole('textbox', { name: 'Contact (optional)' }).fill('sender on Discord');
	await form.getByRole('button', { name: 'Confirm' }).tap();
	await expect(form.getByTestId('report-sent')).toBeVisible();
	await form.getByRole('button', { name: 'Close' }).last().tap();

	// Another account, not an admin: no Reports in the menu, but Account settings opens them.
	const other = await browser.newContext();
	const reader = await other.newPage();
	await signIn(reader, `reader-${Date.now()}@example.com`);
	await expect(reader.getByTestId('account-type')).toHaveText('User');
	await menuButton(reader).tap();
	const menu = reader.getByRole('dialog', { name: APP_NAME });
	await expect(menu.getByRole('link', { name: 'Library' })).toBeVisible();
	await expect(menu.getByRole('link', { name: 'Reports' })).toHaveCount(0);
	await reader.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await reader.getByRole('button', { name: 'Reports', exact: true }).tap();
	await expect(reader).toHaveURL(/\/reports$/);

	const table = reader.getByTestId('reports');
	const row = table.locator('tr', { hasText: title });
	await expect(row).toContainText('No username');
	// Reports sent signed out are for admins only.
	await expect(table).not.toContainText('Signed out');
	// What it was sent with stays with its sender and the admins; triage is for admins.
	await row.getByRole('button', { name: title }).tap();
	const report = reader.getByRole('dialog', { name: new RegExp(title) });
	await expect(report).toContainText('The bag forgets the Drunk.');
	await expect(report).not.toContainText('sender on Discord');
	await expect(report.getByRole('combobox', { name: 'Status' })).toBeDisabled();
	await expect(report.getByRole('button', { name: 'Delete report' })).toBeDisabled();
	await report.getByRole('button', { name: 'Close' }).first().tap();
	await expect(reader.getByRole('button', { name: 'Admins' })).toHaveCount(0);
	// Yourself as the reporter: the Reporter column filters (Trevor, 2026-10-22).
	await expect(table.getByRole('button', { name: 'Filter Reporter' })).toBeVisible();
	expect((await reader.request.get('/api/reports/admins')).status()).toBe(404);
	expect(
		(
			await reader.request.patch('/api/reports/1', {
				data: { status: 'done' },
				headers: { Origin: new URL(reader.url()).origin }
			})
		).status()
	).toBe(404);
	await other.close();

	// The sender sees it with what it was sent with.
	await page.goto('/reports');
	const mine = page.getByTestId('reports').locator('tr', { hasText: title });
	await mine.getByRole('button', { name: title }).tap();
	await expect(page.getByRole('dialog', { name: new RegExp(title) })).toContainText(
		'sender on Discord'
	);
});

test('a report sent from the board carries its script, for its sender and the admins to open', async ({
	page
}) => {
	// Trevor, 2026-10-22: "if submitting report from a script, we should include the script".
	const title = `From a script ${Date.now()}`;
	await signIn(page, `scripted-${Date.now()}@example.com`);
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Report an issue' })
		.tap();

	const form = page.getByRole('dialog', { name: 'Report' });
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	await form.getByRole('textbox', { name: 'Description' }).fill('The Chef counts wrong.');
	await expect(form.getByLabel('Include the script')).toBeChecked();
	await form.getByRole('button', { name: 'Sent with it' }).tap();
	await expect(form.getByTestId('report-script')).toHaveText('Trouble Brewing');
	await form.getByRole('button', { name: 'Confirm' }).tap();
	await expect(form.getByTestId('report-sent')).toBeVisible();
	await form.getByRole('button', { name: 'Close' }).last().tap();

	// Its sender opens the script from the report, as its JSON; the game itself never goes.
	await page.goto('/reports');
	const row = page.getByTestId('reports').locator('tr', { hasText: title });
	await row.getByRole('button', { name: title }).tap();
	const report = page.getByRole('dialog', { name: new RegExp(title) });
	await report.getByRole('button', { name: 'Trouble Brewing' }).tap();
	const json = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(json).toContainText('washerwoman');
	await expect(json).not.toContainText('Seat');
});

test('the Library script popup has Report an issue, and the player view reports its script', async ({
	page
}) => {
	// Trevor, 2026-10-23: "add report button to those screens" (their script covers the footer).
	const script = [{ id: '_meta', name: 'Storm Front', author: 'Trevor' }, 'washerwoman', 'imp'];
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(script))
	});
	const pane = page.getByRole('dialog', { name: 'Storm Front' });
	const report = pane.getByRole('button', { name: 'Report an issue' });
	expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await report.tap();
	const form = page.getByRole('dialog', { name: 'Report' });
	// A script or data report, titled with the script, the script going with it.
	await expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue('Storm Front: ');
	await expect(form.getByRole('combobox', { name: 'Kind' })).toContainText(
		'Script or data problem'
	);
	await form.getByRole('button', { name: 'Sent with it' }).tap();
	await expect(form.getByTestId('report-script')).toHaveText('Storm Front');
	await form.getByRole('button', { name: 'Cancel' }).tap();

	// The player view needs none of its own: the menu's Report an issue takes its script too.
	await page.goto('/play');
	await expect(page.getByRole('main').getByRole('button', { name: 'Report an issue' })).toHaveCount(
		0
	);
	await (await theMenu(page)).getByRole('button', { name: 'Report an issue' }).tap();
	await form.getByRole('button', { name: 'Sent with it' }).tap();
	await expect(form.getByTestId('report-script')).toHaveText('Storm Front');
});
