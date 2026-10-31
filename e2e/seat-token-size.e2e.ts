import { expect, test, type Locator, type Page } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// Trevor, 2026-10-31: "character token for a player with an avatar and laurel is smaller than a
// character token for a player without those". Every seat's token is one size; a laurel is
// drawn round the token, never by shrinking it. Seats are one component (SeatDisc) on the
// Storyteller's board and on a player's Grim, so both are checked.

/** Where SHOTS is set, each check also saves a picture of the seats it compares. */
const SHOTS = process.env.SHOTS;

async function startRoom(page: Page): Promise<string> {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 8);
	await toBoard(page);
	await page.goto(`${new URL(page.url()).pathname}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	return (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
}

/** Opens a seat on the board and runs `act` in its sheet. */
async function inSeatSheet(page: Page, number: number, act: (sheet: Locator) => Promise<void>) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await act(sheet);
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function giveCharacter(page: Page, number: number, name: string, character: string) {
	await inSeatSheet(page, number, async (sheet) => {
		await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for ${name}` })
			.getByRole('button', { name: character, exact: true })
			.tap();
	});
}

/** The width of a seat's token face, which a laurel must leave alone. */
async function faceWidth(seat: Locator): Promise<number> {
	return (await seat.locator('[data-token-face]').first().boundingBox())!.width;
}

test('a laurel and an avatar never make a seat token smaller, on the board or a phone', async ({
	page,
	browser
}, testInfo) => {
	// Two devices and a room: longer than one screen's test.
	test.slow();
	const code = await startRoom(page);

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex Kim');
	await phone.keyboard.press('Escape');
	await phone.evaluate(() => {
		const key = 'grim-games:player-settings:v1';
		const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
		localStorage.setItem(key, JSON.stringify({ ...settings, frame: 'laurel-olive-demon' }));
	});
	await phone.reload();
	await expect(page.getByTestId('status-players')).toHaveText('1 player');

	// Seat 3 is the phone's player, with their avatar and laurel; seat 4 has neither.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await inSeatSheet(page, 3, async (sheet) => {
		await sheet.getByRole('button', { name: 'Edit player name' }).tap();
		await sheet.getByRole('textbox', { name: 'Player name' }).fill('Alex Kim');
		await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	});
	const framed = page.locator('[data-testid="seat"][aria-label^="Seat 3: Alex Kim"]');
	const plain = page.locator('[data-testid="seat"][aria-label^="Seat 4"]');
	await expect(framed.locator('svg[data-frame="laurel-olive-demon"]')).toBeAttached();
	await expect(plain.locator('svg[data-frame]')).toHaveCount(0);

	// Before characters, the avatar is the face; after, the character token is.
	expect.soft(await faceWidth(framed)).toBeCloseTo(await faceWidth(plain), 0);
	await giveCharacter(page, 3, 'Alex Kim', 'Empath');
	await giveCharacter(page, 4, 'Seat 4', 'Chef');
	await expect(framed.getByTestId('avatar-mark')).toBeVisible();
	expect.soft(await faceWidth(framed)).toBeCloseTo(await faceWidth(plain), 0);
	if (SHOTS) {
		await page.screenshot({ path: `${SHOTS}/board-${testInfo.project.name}.png` });
	}

	// On the phone's Grim: the player's own seat, with its laurel, against seat 4's.
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const mine = phone.getByTestId('grim-seat').nth(2);
	const other = phone.getByTestId('grim-seat').nth(3);
	await expect(mine.locator('svg[data-frame="laurel-olive-demon"]')).toBeAttached();
	expect.soft(await faceWidth(mine)).toBeCloseTo(await faceWidth(other), 0);
	if (SHOTS) {
		await other.scrollIntoViewIfNeeded();
		await phone.screenshot({ path: `${SHOTS}/grim-${testInfo.project.name}.png` });
	}
	await phoneContext.close();
});
