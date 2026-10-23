import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';
import { openSettingsDialog } from './shell.ts';

// Frames round seat tokens (L4, Trevor 2026-10-22): the Storyteller's Board default, and each
// player's own pick in Settings > Player.

async function openSettings(page: Page, section: string) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

/** Opens a drop-down and taps one choice, as a finger would. */
async function pick(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label }).tap();
	await page.getByRole('option', { name: option }).tap();
	await expect(page.getByRole('listbox')).toBeHidden();
}

test('the Board default frame draws round the preview and every seat, moving nothing', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Board');
	const preview = dialog.getByTestId('board-preview');
	await expect(dialog.getByRole('combobox', { name: 'Seat frame' })).toContainText('None');
	await expect(preview.locator('svg[data-frame]')).toHaveCount(0);
	await pick(page, 'Seat frame', 'Laurel');
	await expect(preview.locator('svg[data-frame="laurel"]')).toHaveCount(2);
	await page.keyboard.press('Escape');

	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	const seats = page.getByTestId('seat');
	await expect(seats).toHaveCount(8);
	await expect(page.locator('[data-testid="seat"] svg[data-frame="laurel"]')).toHaveCount(8);
	const framed = await seats.first().boundingBox();

	// The frame sits inside the token: with none, the seat keeps the same place and size.
	await page.evaluate(() => {
		const key = 'grim.boardLooks';
		const looks = JSON.parse(localStorage.getItem(key) ?? '{}');
		localStorage.setItem(key, JSON.stringify({ ...looks, defaultFrame: 'none' }));
	});
	await page.reload();
	await expect(seats).toHaveCount(8);
	await expect(page.locator('[data-testid="seat"] svg[data-frame]')).toHaveCount(0);
	expect(await seats.first().boundingBox()).toEqual(framed);
});

test("a player picks their own frame, or leaves it to the Storyteller's", async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Player');
	const frame = dialog.getByRole('combobox', { name: 'Your frame' });
	await expect(frame).toContainText("Storyteller's choice");
	await pick(page, 'Your frame', 'Vines');
	await expect(frame).toContainText('Vines');
	await expect(frame.locator('svg[data-frame="vines"]')).toBeAttached();

	await page.reload();
	const again = await openSettings(page, 'Player');
	await expect(again.getByRole('combobox', { name: 'Your frame' })).toContainText('Vines');
});
