import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';

// Count off (plan J40; Trevor, 2026-10-30: "a count off, ppl select, and call it a day if it
// seems accurate"; names show with the numbers, and players without a phone count too).

async function openRoom(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.goto(board);
	return code;
}

async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function joinAs(browser: Browser, testInfo: TestInfo, code: string, name: string) {
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, name);
	await phone.keyboard.press('Escape');
	return phone;
}

test('the table counts off round the clock, and Done seats everyone in that order', async ({
	page,
	browser
}, testInfo) => {
	// Two phones join, one after the other.
	test.slow();
	const code = await openRoom(page);
	await nameSeat(page, 1, 'Cy');
	const ana = await joinAs(browser, testInfo, code, 'Ana');
	const bo = await joinAs(browser, testInfo, code, 'Bo');

	// The Storyteller picks who is 1.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Count off' })
		.tap();
	const host = page.getByTestId('count-off-host');
	await host.getByTestId('count-off-first').filter({ hasText: 'Cy' }).tap();
	await expect(host.getByRole('button', { name: '1: Cy' })).toBeVisible();

	// Each phone gets the sheet, with no grim behind it, and taps its number.
	const sheet = ana.getByTestId('count-off');
	await expect(sheet).toContainText(/Count clockwise from\s*Cy/);
	await sheet.getByRole('button', { name: '3: free' }).tap();
	await expect(sheet.getByRole('button', { name: '3: Ana' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await bo.getByTestId('count-off').getByRole('button', { name: '2: free' }).tap();
	// Everyone sees the names with the numbers.
	await expect(sheet.getByRole('button', { name: '2: Bo' })).toBeVisible();
	await expect(host.getByRole('button', { name: '3: Ana' })).toBeVisible();

	// A player without a phone: the Storyteller names their number.
	await host.getByRole('button', { name: '4: free' }).tap();
	const naming = page.getByRole('alertdialog', { name: 'Player for 4' });
	await naming.getByRole('textbox').fill('Dan');
	await naming.getByRole('button', { name: 'Confirm' }).tap();
	await expect(sheet.getByRole('button', { name: '4: Dan' })).toBeVisible();

	// Done: the board takes that order and those names, and the phones' sheets close.
	await page.getByRole('button', { name: 'Done' }).tap();
	await expect(page.getByRole('button', { name: /^Seat 1: Cy/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Seat 2: Bo/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Seat 3: Ana/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Seat 4: Dan/ })).toBeVisible();
	await expect(sheet).toBeHidden();
	await expect(ana.getByTestId('you-row')).toHaveAttribute('data-seat', '3');

	await ana.context().close();
	await bo.context().close();
});
