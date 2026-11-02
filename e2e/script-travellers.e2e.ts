import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// On the script in a game, the Travellers are the ones in play, each marked recommended or
// not on its band, as Not in play and Bluff are (Trevor, 2026-11-02: a Voudon added though
// not recommended showed under Recommended Travellers).
test('the script lists the Travellers in play, marked recommended or not', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByRole('button', { name: /^Voudon/ }).tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const script = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(script.getByRole('button', { name: 'Travellers', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(script.locator('[data-character="voudon"]')).toContainText('Not recommended');
	// The recommended ones not in play are left out.
	await expect(script.locator('[data-character="scapegoat"]')).toHaveCount(0);
});
