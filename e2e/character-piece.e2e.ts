import { expect, test, type Page } from '@playwright/test';

/*
 * The one character piece (Character.svelte) on its preview page, through each template
 * and its switches (Trevor, 2026-11-02: one component, parts turned on or off). With SHOTS
 * set, each look is also saved as a picture under test-results for review.
 */

async function open(page: Page) {
	await page.goto('/spikes/character');
	await expect(page.getByTestId('character-stage').locator('img').first()).toBeVisible();
}

async function flip(page: Page, name: string) {
	await page.getByText(name, { exact: true }).tap();
}

async function pick(page: Page, template: string) {
	await page.getByRole('combobox', { name: 'Template' }).tap();
	await page.getByRole('option', { name: template }).tap();
}

async function shot(page: Page, name: string) {
	if (!process.env.SHOTS) return;
	await page.evaluate(() => document.fonts.ready);
	await page
		.getByTestId('character-stage')
		.screenshot({ path: test.info().outputPath(`${name}.png`) });
}

test('the row template is the script row, and its ability turns off', async ({ page }) => {
	await open(page);
	const stage = page.getByTestId('character-stage');
	const row = stage.locator('.ring-row').first();
	await expect(row.locator('.ring-ability')).toBeVisible();
	await shot(page, 'row');
	const withAbility = (await row.boundingBox())!;

	await flip(page, 'Ability');
	await expect(row.locator('.ring-ability')).toHaveCount(0);
	await expect(row.locator('.band')).toContainText('Witch');
	// Same ring, same band: only the ability is gone.
	const nameOnly = (await row.boundingBox())!;
	expect(nameOnly.width).toBeCloseTo(withAbility.width, 0);
	await shot(page, 'name-only');
});

test('the row carries its player, tags, controls, text and a count beside it', async ({ page }) => {
	await open(page);
	for (const name of ['Player name', 'Tag', 'Controls', 'Text under it', 'Count beside it']) {
		await flip(page, name);
	}
	const row = page.getByTestId('character-stage').locator('.ring-row').first();
	await expect(row.locator('.band')).toContainText('Sam');
	await expect(row.locator('.band')).toContainText('Bluff');
	await expect(row.getByRole('button', { name: 'Lock' })).toBeVisible();
	await expect(row.locator('.ring-below')).toContainText('Chose the Librarian tonight.');
	// The count sits on the band's line, outside the band.
	const band = (await row.locator('.band').boundingBox())!;
	const aside = (await row.locator('.aside').boundingBox())!;
	expect(aside.x).toBeGreaterThanOrEqual(band.x + band.width - 1);
	expect(Math.abs(aside.y - band.y)).toBeLessThan(band.height);
	await shot(page, 'row-everything');
});

test('a row need not run the full width', async ({ page }) => {
	await open(page);
	await flip(page, 'Ability');
	const stage = page.getByTestId('character-stage');
	const row = stage.locator('.ring-row').first();
	const full = (await row.boundingBox())!;
	await flip(page, 'Full width');
	await expect(row).toHaveAttribute('data-fit', '');
	const fit = (await row.boundingBox())!;
	expect(fit.width).toBeLessThan(full.width);
	await shot(page, 'name-fit');
});

test('the badge and entry templates draw the pill', async ({ page }) => {
	await open(page);
	await pick(page, 'Badge');
	await flip(page, 'Player name');
	const stage = page.getByTestId('character-stage');
	await expect(stage.locator('.badge').first()).toContainText('Sam');
	await shot(page, 'badge');

	await pick(page, 'Entry');
	await flip(page, 'Text under it');
	await expect(stage.locator('.entry')).toContainText('Chose the Librarian tonight.');
	await shot(page, 'entry');
});
