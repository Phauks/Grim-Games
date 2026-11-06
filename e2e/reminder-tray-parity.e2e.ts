import { expect, test } from '@playwright/test';
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
	// A tap makes one and opens its look, as the bank's does.
	await make.tap();
	const text = page.getByTestId('reminder-note');
	await text.fill('Chose');
	await text.press('Enter');
	await page.keyboard.press('Escape');
	await expect(text).toBeHidden();
	const mine = tray.getByRole('button', { name: 'Generic reminder: Chose' });
	await expect(mine).toHaveCount(1);
	// Its copies go on seats with its words, and it stays in the tray.
	const seat = page.getByTestId('grim-seat').nth(1);
	await mine.tap();
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
