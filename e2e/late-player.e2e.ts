import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// Add late player (Trevor, 2026-10-30): someone arrives after the tiles are dealt and joins as
// one more player instead of a Traveller. Roll suggests who changes; the Storyteller confirms.

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

test('Add late player seats late players where tapped and makes room in the bag', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
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

	// The button opens the grimoire to tap where the late player sits (Trevor, 2026-10-30).
	await page.getByRole('button', { name: 'Add late player' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: /^Place between Seat 1 and Seat 2$/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Add late player' });
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(1);
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Max');
	// A second late player, placed at their own spot.
	await sheet.getByTestId('late-add-another').tap();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: /^Place between Seat 3 and Seat 4$/ }).tap();
	await expect(sheet.getByTestId('late-player-row')).toHaveCount(2);
	await expect(sheet.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Max');
	await sheet.getByRole('textbox', { name: 'Name' }).nth(1).fill('Noa');
	// Seven players have 5, 0, 1, 1 (https://wiki.bloodontheclocktower.com/Setup).
	await expect(sheet).toContainText('5 → 7 players');
	await expect(sheet.getByTestId('late-check')).toContainText('Not the 7-player counts');

	// The tabs keep one size, so nothing moves as the roll fills them in.
	const before = await sheet.boundingBox();
	await sheet.getByTestId('late-roll').tap();
	await expect(sheet.getByTestId('late-check')).toHaveText('Matches the 7-player counts.');
	await expect(sheet.getByTestId('late-bag').getByRole('listitem')).toHaveCount(2);
	expect(await sheet.boundingBox()).toEqual(before);
	await sheet.getByRole('tab', { name: 'Changes' }).tap();
	await expect(sheet.getByTestId('late-change-list')).toContainText('Max');
	await expect(sheet.getByTestId('late-change-list')).toContainText('Noa');
	await sheet.getByRole('tab', { name: 'Before' }).tap();
	await expect(sheet.getByTestId('late-before').getByTestId('count-townsfolk')).toHaveText('3');

	await sheet.getByRole('button', { name: 'Confirm and tell players' }).tap();
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: /^Seat 2: Max/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Seat 5: Noa/ })).toBeVisible();
	// Max and Noa draw the two tiles in the bag.
	await page.goto(page.url() + '/draw');
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(5);
	await expect(page.getByRole('button', { name: /^Tile \d$/ })).toHaveCount(2);
});
