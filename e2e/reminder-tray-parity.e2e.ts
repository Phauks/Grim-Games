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
