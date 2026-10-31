import { expect, test } from '@playwright/test';
import { toBoard } from './new-game.ts';

// The game's settings on players' phones (Trevor, 2026-10-30: "setup on players phones should
// show the different options in the game setting menu so users understand"): read only, beside
// Your character, from Setup on, following the Storyteller's changes.

test("players' phones show the game's settings, read only, as the Storyteller changes them", async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('players-status')).toContainText('Setup');
	// On the Your character row, which is still disabled in Setup.
	await expect(phone.getByTestId('your-character')).toBeDisabled();
	const open = phone.getByTestId('player-game-settings');
	await expect(open).toBeEnabled();
	const row = (await phone.getByTestId('your-character').boundingBox())!;
	const button = (await open.boundingBox())!;
	expect(Math.abs(button.y - row.y)).toBeLessThan(2);
	expect(button.height).toBeGreaterThanOrEqual(44);
	await open.tap();
	const dialog = phone.getByRole('dialog', { name: 'Game settings' });
	const list = dialog.getByTestId('player-game-settings-list');
	await expect(list.locator('[data-field="timerPerPlayer"]')).toHaveText('30');
	await expect(list.locator('[data-field="trackNominations"]')).toHaveText('Off');
	await expect(list.locator('[data-field="holdToReveal"]')).toHaveText(/^(On|Off)$/);
	// Read only: nothing to switch.
	await expect(list.getByRole('checkbox')).toHaveCount(0);
	await expect(list.getByRole('combobox')).toHaveCount(0);

	// The Storyteller turns nomination tracking on for this game; the phone follows.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Game settings' })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Game settings' });
	await settings.getByText('Track nominations', { exact: true }).tap();
	await expect(list.locator('[data-field="trackNominations"]')).toHaveText('On');
	await phoneContext.close();
});
