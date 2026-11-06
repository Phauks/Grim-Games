import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

/**
 * The Choose a script sheet (Trevor, 2026-11-06, option B of "Custom script picker"): one
 * sheet for every custom script, with this device's scripts, Search's online sources and
 * Add script, used by New game's Custom and /play's Custom alike.
 */

const bigTown = [
	{ id: '_meta', name: 'Big Town', author: 'Someone Big' },
	...['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller'],
	...['undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor'],
	...['butler', 'drunk', 'recluse', 'saint', 'poisoner', 'spy', 'scarletwoman', 'baron', 'imp']
];

function scriptToolLink(script: unknown[]): string {
	const payload = gzipSync(Buffer.from(JSON.stringify(script))).toString('base64');
	return `https://script.bloodontheclocktower.com/?script=${encodeURIComponent(payload)}`;
}

test.beforeEach(async ({ page }) => {
	await page.route('**/api/curated', (route) =>
		route.fulfill({
			json: { scripts: [{ section: 'recommended', link: scriptToolLink(bigTown), json: bigTown }] }
		})
	);
});

const sheet = (page: Page) => page.getByTestId('script-sheet');

/** Sets the sheet's Where drop-down. */
async function lookIn(page: Page, where: string) {
	await sheet(page).getByRole('combobox', { name: 'Where' }).tap();
	await page.getByRole('option', { name: where, exact: true }).tap();
}

test('New game finds an online script in the sheet without leaving the screen', async ({
	page
}) => {
	await page.goto('/new');
	const custom = page.getByRole('radiogroup', { name: 'Script' }).getByRole('radio', {
		name: 'Custom'
	});
	const field = page.getByTestId('custom-script');
	await field.tap();
	// This device's scripts first: none saved yet.
	await expect(sheet(page).getByRole('combobox', { name: 'Where' })).toHaveText(/On this device/);
	await expect(sheet(page)).toContainText('None');
	await lookIn(page, 'Official custom scripts');
	await sheet(page).getByRole('button').filter({ hasText: 'Big Town' }).tap();
	await expect(sheet(page)).toBeHidden();
	await expect(page).toHaveURL(/\/new$/);
	await expect(field).toHaveText('Big Town');
	await expect(custom).toBeChecked();
	await expect(page.getByTestId('chosen-script').getByTestId('script-byline')).toHaveText(
		'by Someone Big'
	);
	// Saved to Recent, so the sheet lists it on this device next time.
	await field.tap();
	await expect(
		sheet(page)
			.getByRole('region', { name: 'Recent' })
			.getByRole('button', { name: /Big Town/ })
	).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
});

test('Add script opens from the sheet', async ({ page }) => {
	await page.goto('/new');
	await page.getByTestId('custom-script').tap();
	await page
		.getByRole('dialog', { name: 'Choose a script' })
		.getByRole('button', { name: 'Add script' })
		.tap();
	const add = page.getByRole('dialog', { name: 'Add script' });
	await expect(add).toBeVisible();
	await expect(add.getByRole('button', { name: 'Upload File' })).toBeVisible();
	await expect(add.getByRole('button', { name: 'Take a Photo' })).toBeVisible();
});

test("/play's Custom opens the same sheet, and a pick plays at once", async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Custom' }).tap({ timeout: 15_000 });
	await lookIn(page, 'Official custom scripts');
	await sheet(page).getByRole('button').filter({ hasText: 'Big Town' }).tap();
	await expect(sheet(page)).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Big Town', level: 1 })).toBeVisible();
	await expect(page).toHaveURL(/\/play$/);
});
