import { expect, test, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

// Laurels round seat tokens (L4, A1): each player's own pick in their Profile. The fixed
// frames are laurel forms, and the Storyteller's Board default is gone (Trevor, 2026-10-27).

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

/** Opens the Profile from the button beside Settings' X (Trevor, 2026-10-27). */
async function openProfile(page: Page) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog.getByRole('button', { name: 'Profile', exact: true }).tap();
	await expect(dialog.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
	return dialog;
}

/** Opens a drop-down and taps one choice, as a finger would. */
async function pick(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label }).tap();
	await page.getByRole('option', { name: option }).tap();
	await expect(page.getByRole('listbox')).toBeHidden();
}

test("the Board has no frame of its own: laurels are each player's", async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Board');
	await expect(dialog.getByRole('combobox', { name: 'Seat frame' })).toHaveCount(0);
	await expect(dialog.getByTestId('board-preview').locator('svg[data-frame]')).toHaveCount(0);
});

test('a player picks a laurel form and its colour, and keeps both', async ({ page }) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	const form = dialog.getByRole('combobox', { name: 'Your laurel' });
	const colour = dialog.getByRole('combobox', { name: 'Laurel colour' });
	await expect(form).toContainText('None');
	// The colour row is always there, so picking a form moves nothing; fixed forms disable it.
	await expect(colour).toBeDisabled();
	await pick(page, 'Your laurel', 'Vines');
	await expect(form.locator('svg[data-frame="vines"]')).toBeAttached();
	await expect(colour).toBeDisabled();

	const below = await colour.boundingBox();
	await pick(page, 'Your laurel', 'Olive');
	await expect(form.locator('svg[data-frame="laurel-olive-gold"]')).toBeAttached();
	await expect(colour).toBeEnabled();
	expect(await colour.boundingBox()).toEqual(below);
	await pick(page, 'Laurel colour', 'Demon red');
	await expect(form.locator('svg[data-frame="laurel-olive-demon"]')).toBeAttached();

	await page.reload();
	const again = await openProfile(page);
	await expect(
		again
			.getByRole('combobox', { name: 'Your laurel' })
			.locator('svg[data-frame="laurel-olive-demon"]')
	).toBeAttached();
	await expect(again.getByRole('combobox', { name: 'Laurel colour' })).toContainText('Demon red');
});
