import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { openBin } from './reminder-bank.ts';

// A player's reminder tray and the Storyteller's bank are built from the same pieces (Trevor,
// 2026-11-06: "I want them to use the same components for parity"): "+ New token" and the
// tray's own ∞ tokens on a player's grim, and the search on the Storyteller's bank.

test("a player's tray makes its own ∞ tokens with + New token, as the bank does", async ({
	page
}) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	const make = tray.getByRole('button', { name: 'New token' });
	await make.scrollIntoViewIfNeeded();
	// A tap makes one and opens its look, as the bank's does; Enter confirms it, in hand.
	await make.tap();
	const text = page.getByTestId('reminder-note');
	await text.fill('Chose');
	await text.press('Enter');
	await expect(text).toBeHidden();
	const mine = tray.getByRole('button', { name: 'Generic reminder: Chose' });
	await expect(mine).toHaveCount(1);
	// Its copies go on seats with its words, and it stays in the tray.
	const seat = page.getByTestId('grim-seat').nth(1);
	await seat.tap();
	await expect(seat).toHaveAttribute('aria-label', /your reminders: Chose$/);
	await expect(mine).toHaveCount(1);

	// Holding a character's reminder, "+ New token" takes it as a copy with its words.
	await openBin(page);
	await page.getByTestId('reminder-bin').getByRole('button', { name: 'Poisoned reminder' }).tap();
	await make.tap();
	await expect(tray.getByRole('button', { name: 'Generic reminder: Poisoned' })).toHaveCount(1);

	// Kept on the phone for the game.
	await page.reload();
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await expect(tray.getByRole('button', { name: 'Generic reminder: Chose' })).toHaveCount(1);
});

test("the Storyteller's bank has the player's tray's search", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const bin = await openBin(page);
	const search = bin.getByRole('searchbox', { name: 'Search reminders' });
	await search.fill('zzz-no-match');
	await expect(bin.getByTestId('board-reminder')).toHaveCount(0);
	await search.fill('');
	await expect(bin.getByTestId('board-reminder').first()).toBeVisible();
});

// Trevor (2026-11-10, phone): searching the bank found the tokens, but under the on-screen
// keyboard. The keyboard is played by `--keyboard-inset` (keyboard-inset.ts), as in setup.e2e.ts:
// over the lower 45% of the screen, the tokens found and the tray's foot stay above it.
async function searchOverKeyboard(page: Page, bin: Locator) {
	const search = bin.getByRole('searchbox', { name: 'Search reminders' });
	await search.focus();
	const height = page.viewportSize()!.height;
	await page.evaluate(
		(inset) => document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`),
		Math.round(height * 0.45)
	);
	await search.fill('poison');
	const found = bin.getByRole('button', { name: 'Poisoned reminder' });
	await expect(found).toBeVisible();
	for (const box of [await found.boundingBox(), await bin.boundingBox()]) {
		expect(box!.y + box!.height).toBeLessThanOrEqual(height * 0.55 + 1);
	}
	expect((await search.boundingBox())!.y).toBeGreaterThanOrEqual(0);
}

test("the tokens the Storyteller's bank search finds stay above the keyboard", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await searchOverKeyboard(page, await openBin(page));
});

test("the tokens a player's tray search finds stay above the keyboard", async ({ page }) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await searchOverKeyboard(page, await openBin(page));
});

// Trevor (2026-11-10): the search runs the bank's whole width, above the run button even when
// nothing is found.
test("the bank's search runs its whole width, clear of the run button", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const bin = await openBin(page);
	const search = bin.getByRole('searchbox', { name: 'Search reminders' });
	await search.fill('zzz-no-match');
	const field = (await page.locator('.search-field').first().boundingBox())!;
	const run = (await page.locator('.run').first().boundingBox())!;
	expect(field.x + field.width).toBeGreaterThan(run.x + run.width / 2);
	expect(field.y + field.height).toBeLessThanOrEqual(run.y);
});

// Trevor (2026-11-10): "Should be able to remove tokens, either in player or storyteller, by
// dragging back to token bank". Both views take a seat's token back the same way: dragged and
// let go anywhere on the tray, off it comes, and "+ New token" glows while it moves.
async function dragBackToTray(page: Page, token: Locator) {
	const from = (await token.boundingBox())!;
	const tray = (await page.locator('[data-tray]').boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(tray.x + 8, tray.y + tray.height / 2 - 30, { steps: 6 });
	await expect(page.locator('.new-token').first()).toHaveAttribute('data-glow', 'ready');
	await page.mouse.move(tray.x + 8, tray.y + tray.height / 2, { steps: 4 });
	await page.mouse.up();
}

/** Makes a ∞ token called `words` and puts it on `seat`. */
async function placeOwnToken(page: Page, seat: Locator, words: string) {
	await openBin(page);
	const make = page.locator('[data-tray]').getByRole('button', { name: 'New token' });
	await make.scrollIntoViewIfNeeded();
	await make.tap();
	await page.getByTestId('reminder-note').fill(words);
	await page.getByTestId('reminder-note').press('Enter');
	await seat.tap();
	// Taken from the pulled-up tray, it lowered to its row, in both views.
	await expect(page.getByTestId('reminder-bin')).toBeHidden();
}

const onSeats = (page: Page, name: string) =>
	page.locator(`[data-testid="board-reminder"][aria-label="${name}"]:not([data-tray] *)`);

test("a player's token dragged back onto the tray comes off its seat", async ({ page }) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	const seat = page.getByTestId('grim-seat').nth(1);
	await placeOwnToken(page, seat, 'Chose');
	await expect(seat).toHaveAttribute('aria-label', /your reminders: Chose$/);
	await dragBackToTray(page, onSeats(page, 'Generic reminder: Chose'));
	await expect(seat).not.toHaveAttribute('aria-label', /your reminders/);
	await expect(onSeats(page, 'Generic reminder: Chose')).toHaveCount(0);
	// The tray keeps the token itself.
	await expect(
		page.locator('[data-tray]').getByRole('button', { name: 'Generic reminder: Chose' })
	).toHaveCount(1);
});

test("the Storyteller's token dragged back onto the bank comes off its seat", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await placeOwnToken(page, page.getByRole('button', { name: /^Seat 2:/ }), 'Chose');
	await expect(onSeats(page, 'Generic reminder: Chose')).toHaveCount(1);
	await dragBackToTray(page, onSeats(page, 'Generic reminder: Chose'));
	await expect(onSeats(page, 'Generic reminder: Chose')).toHaveCount(0);
	await expect(
		page.locator('[data-tray]').getByRole('button', { name: 'Generic reminder: Chose' })
	).toHaveCount(1);
});

test("holding a reminder, the bank's + New token takes it as a copy, as a player's tray does", async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const bin = await openBin(page);
	const tray = page.locator('[data-tray]');
	const before = await tray.getByRole('button', { name: /^Generic reminder/ }).count();
	await bin.getByRole('button', { name: 'Generic reminder', exact: true }).first().tap();
	await tray.getByRole('button', { name: 'New token' }).tap();
	await expect(tray.getByRole('button', { name: /^Generic reminder/ })).toHaveCount(before + 1);
	// A copy, not a blank token's editor; the bank lowered to its row.
	await expect(page.getByTestId('reminder-note')).toBeHidden();
	await expect(page.getByTestId('reminder-bin')).toBeHidden();
});
