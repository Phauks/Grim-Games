import { expect, test, type Browser, type Page } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { pickScript } from './new-game.ts';
import { pickNumber } from './number-select.ts';
import { openPlayerSheet, openPlayers } from './players.ts';

// Give a seat (Trevor, 2026-11-06, option A): the Storyteller seats a spectator from Players,
// once characters are dealt, in an open seat or one a player has (asking first). The new
// player may see their own character while nobody else's opens.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function joinAs(browser: Browser, use: object, code: string, name: string) {
	const phone = await (await browser.newContext(use)).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, name);
	await phone.keyboard.press('Escape');
	return phone;
}

/** Opens Give a seat on the spectator `name`'s sheet in Players. */
async function giveSeat(page: Page, name: string) {
	const sheet = await openPlayerSheet(page, name);
	await sheet.getByTestId('give-seat').tap();
	const list = page.getByTestId('give-seat-list');
	await expect(list).toBeVisible();
	return list;
}

test('the Storyteller gives a spectator an open seat, or a player’s seat after asking', async ({
	page,
	browser
}, testInfo) => {
	test.slow();
	const use = { ...testInfo.project.use };
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	// Seats 1 to 4 named, Seat 5 open; dealt with players' characters hidden.
	await page.goto(board);
	for (const [n, name] of [
		[1, 'Bea'],
		[2, 'Cal'],
		[3, 'Dee'],
		[4, 'Eli']
	] as const)
		await nameSeat(page, n, name);
	await page.goto(`${board}/draw`);
	await page.getByRole('button', { name: 'Deal' }).tap();
	const deal = page.getByRole('alertdialog', { name: 'Deal at random?' });
	await deal.getByText('Players can see their character').tap();
	await expect(
		deal.getByRole('checkbox', { name: 'Players can see their character', includeHidden: true })
	).not.toBeChecked();
	await deal.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);

	const bea = await joinAs(browser, use, code, 'Bea');
	await expect(bea.getByTestId('you-row')).toHaveAttribute('data-seat', '1');
	await expect(bea.getByTestId('your-character')).toHaveCount(0);
	const alex = await joinAs(browser, use, code, 'Alex');
	await page.goto(board);

	// Open seats come first; a seat with a player says so.
	const list = await giveSeat(page, 'Alex');
	const options = list.getByTestId('give-seat-option');
	await expect(options).toHaveCount(5);
	await expect(options.first()).toHaveAttribute('data-seat', '5');
	await expect(options.first()).toContainText('Open');
	await expect(options.nth(1)).toContainText('Has a player');

	// An open seat is given straight away; Alex may see theirs, Bea still may not.
	await options.first().tap();
	await expect(list).toBeHidden();
	await expect(alex.getByTestId('you-row')).toHaveAttribute('data-seat', '5');
	await expect(alex.getByTestId('your-character')).toBeVisible();
	await expect(bea.getByTestId('your-character')).toHaveCount(0);
	const players = page.getByRole('dialog', { name: 'Players', exact: true });
	await expect(players.getByTestId('room-spectators').getByTestId('room-player')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(players).toBeHidden();

	// A seat with a player asks first; Cancel changes nothing.
	const sam = await joinAs(browser, use, code, 'Sam');
	let seats = await giveSeat(page, 'Sam');
	await seats.locator('[data-seat="1"]').tap();
	const ask = page.getByRole('alertdialog', { name: 'Replace this player?' });
	await expect(ask).toContainText('Bea');
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(ask).toBeHidden();
	await expect(bea.getByTestId('you-row')).toHaveAttribute('data-seat', '1');
	if (await seats.isVisible()) await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');

	// Confirm: Sam has Seat 1 and its character, and Bea is a spectator now.
	seats = await giveSeat(page, 'Sam');
	await seats.locator('[data-seat="1"]').tap();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(sam.getByTestId('you-row')).toHaveAttribute('data-seat', '1');
	await expect(sam.getByTestId('your-character')).toBeVisible();
	await expect(bea.getByTestId('your-character')).toHaveCount(0);
	const after = (await players.isVisible()) ? players : await openPlayers(page);
	await expect(after.getByTestId('room-spectators').getByTestId('room-player')).toHaveText([
		/Bea\s*No seat/
	]);
	for (const phone of [bea, alex, sam]) await phone.context().close();
});
