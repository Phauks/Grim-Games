import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { heldAction, putReminder } from './reminder-bank.ts';

/**
 * A run's tokens on one seat stack on the board as one token, the latest on top, with the
 * bank's ×count (Trevor, 2026-11-19: "Courtier drunk tokens aren't stacking on grim?", look A).
 * A tap takes the top one, so the rest stay put.
 */

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByRole('button', { name, exact: true }).tap();
	await expect(picker).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("the Courtier's Drunk tokens on one seat stack, the latest on top", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await choose(page, 1, 'Courtier');
	await choose(page, 2, 'Tea Lady');
	await putReminder(page, 'Drunk 1', 2);
	await putReminder(page, 'Drunk 2', 2);

	const seat = page.locator('.chip-slot[data-seat="2"]');
	await expect(seat).toHaveCount(1);
	await expect(seat.getByRole('button', { name: 'Drunk 2 reminder' })).toBeVisible();
	await expect(seat.getByLabel('2 copies')).toBeVisible();

	// A tap takes the top token; taken off, Drunk 1 is left on its own.
	await seat.getByRole('button', { name: 'Drunk 2 reminder' }).tap();
	await heldAction(page, 'Remove reminder');
	const stays = page.getByRole('alertdialog', { name: 'Confirm change?' });
	if (await stays.isVisible()) await stays.getByRole('button', { name: 'Confirm' }).tap();
	await expect(seat.getByRole('button', { name: 'Drunk 1 reminder' })).toBeVisible();
	await expect(seat.getByLabel(/copies$/)).toHaveCount(0);
});
