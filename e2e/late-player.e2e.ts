import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// Add late player (Trevor, 2026-10-30): someone arrives after the tiles are dealt and joins as
// one more player instead of a Traveller. Roll suggests who changes; the Storyteller confirms.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

test('Add late player makes room for one more player in the bag draw', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);

	await page.getByRole('button', { name: 'Deal' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Deal at random?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);

	await page.getByRole('button', { name: 'Add late player' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Add late player' });
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Max');
	// Six players have one Outsider (https://wiki.bloodontheclocktower.com/Setup).
	await expect(sheet).toContainText('5 → 6 players');
	await expect(sheet.getByTestId('late-counts')).toContainText('0 → 1');
	await expect(sheet.getByTestId('late-no-changes')).toHaveText('None');
	// Before the roll, the bag is short of the Outsider: the check warns but never locks.
	await expect(sheet.getByTestId('late-check')).toContainText('Not the 6-player counts');

	// Nothing moves as the roll fills the sheet in.
	const before = await sheet.boundingBox();
	await sheet.getByTestId('late-roll').tap();
	await expect(sheet.getByTestId('late-check')).toHaveText('Matches the 6-player counts.');
	await expect(sheet.getByTestId('late-roll')).toHaveText(/Roll again/);
	expect(await sheet.boundingBox()).toEqual(before);

	await sheet.getByRole('button', { name: 'Confirm and tell players' }).tap();
	await expect(sheet).toBeHidden();
	// Max draws the one tile in the bag: an Outsider, or a character the roll put back.
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);
	await expect(page.getByRole('button', { name: /^Tile \d$/ })).toHaveCount(1);
});
