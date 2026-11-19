import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';
import { paneButton } from './players.ts';

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

async function joinAs(browser: Browser, testInfo: TestInfo, code: string, name?: string) {
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	if (!name) return phone;
	await openProfile(phone);
	await setPlayerName(phone, name);
	await phone.keyboard.press('Escape');
	return phone;
}

/** The Storyteller locks who is at the top of the clock, number 1. */
async function lockFirst(page: Page, name: string) {
	await page
		.getByTestId('count-off-host')
		.getByRole('combobox', { name: 'Top of the clock' })
		.tap();
	await page.getByRole('option', { name, exact: true }).tap();
}

async function startCountOff(page: Page) {
	await paneButton(page, 'Seats', 'Seating');
	await page
		.getByRole('toolbar', { name: 'Grimoire' })
		.getByRole('button', { name: 'Count off' })
		.tap();
	return page.getByTestId('count-off-host');
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

	// Count off, in Seating's top bar (Trevor, 2026-11-01). The Storyteller locks who is 1 first
	// (Trevor, 2026-11-16: "lock 1, only allow selecting once a 1 is locked").
	const host = await startCountOff(page);
	const sheet = ana.getByTestId('count-off');
	await expect(sheet).toContainText('Waiting for the Storyteller to pick who is 1');
	await expect(sheet.getByRole('button', { name: '2: free' })).toBeDisabled();
	await lockFirst(page, 'Cy');
	await expect(host.getByRole('button', { name: '1: Cy' })).toBeVisible();

	// Each phone gets the sheet, with no grim behind it, and taps its number in any order; 1 is
	// the Storyteller's.
	await expect(sheet).toContainText(/Count clockwise from\s*Cy/);
	await expect(sheet.getByRole('button', { name: '1: Cy' })).toBeDisabled();
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
	await expect(ana.getByTestId('player-status-row')).toHaveAttribute('data-seat', '3');
	// Seating's own Done leaves the mode, and its controls with it.
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	await toolbar.getByRole('button', { name: 'Done' }).tap();
	await expect(toolbar.getByRole('button', { name: 'Count off' })).toHaveCount(0);

	await ana.context().close();
	await bo.context().close();
});

test('a phone taps its number again to let it go, and a phone with no name gives one first', async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-11-16, after a playtest: "one person tried clicking the button and it never
	// worked" (their phone had no name, which the count needs), and "they couldn't unselect a
	// seat once it had been selected".
	test.slow();
	const code = await openRoom(page);
	await nameSeat(page, 1, 'Cy');
	const ana = await joinAs(browser, testInfo, code, 'Ana');
	const nameless = await joinAs(browser, testInfo, code);
	const host = await startCountOff(page);
	await lockFirst(page, 'Cy');
	const sheet = ana.getByTestId('count-off');

	await sheet.getByRole('button', { name: '3: free' }).tap();
	await expect(host.getByRole('button', { name: '3: Ana' })).toBeVisible();
	await sheet.getByRole('button', { name: '3: Ana' }).tap();
	await expect(sheet.getByRole('button', { name: '3: free' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(host.getByRole('button', { name: '3: free' })).toBeVisible();
	// With no number the sheet stays open, to tap the right one.
	await sheet.getByRole('button', { name: '2: free' }).tap();
	await expect(host.getByRole('button', { name: '2: Ana' })).toBeVisible();

	// The phone with no name: its tap asks for one, then takes the number.
	const theirs = nameless.getByTestId('count-off');
	await theirs.getByRole('button', { name: '4: free' }).tap();
	const naming = nameless.getByRole('dialog', { name: 'Your name' });
	await naming.getByRole('textbox', { name: 'Your name' }).fill('Bo');
	await naming.getByRole('button', { name: 'Save' }).tap();
	await expect(theirs.getByRole('button', { name: '4: Bo' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(host.getByRole('button', { name: '4: Bo' })).toBeVisible();

	await ana.context().close();
	await nameless.context().close();
});
