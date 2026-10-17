import { expect, test, type Page } from '@playwright/test';

/**
 * Game modes on New game (Trevor, 2026-10-17): choose a mode, inspect every part of it, and
 * restrict characters. Whale Buffet's rules: https://whalebuffet.com/.
 */
const modePicker = (page: Page) => page.getByRole('combobox', { name: 'Game mode' });

async function chooseMode(page: Page, name: string) {
	await modePicker(page).tap();
	await page.getByRole('option', { name, exact: true }).tap();
	await expect(modePicker(page)).toContainText(name);
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('Inspect shows every part of a mode with its status and the mode file', async ({ page }) => {
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	await page.getByRole('button', { name: 'Inspect Whale Buffet' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Whale Buffet' });
	await expect(dialog.getByRole('link', { name: 'Whalebuffet', exact: true })).toHaveAttribute(
		'href',
		'https://whalebuffet.com/'
	);
	const banned = dialog.locator('[data-part="restricted"]');
	await expect(banned).toContainText('Run by the app');
	for (const name of ['Atheist', 'Engineer', 'Pit-Hag'])
		await expect(banned.getByRole('button', { name, exact: true })).toBeVisible();
	await expect(dialog.locator('[data-part="assignment"]')).toContainText('Run by the Storyteller');
	await expect(dialog.locator('[data-part="towns"]')).toContainText('Standard');
	await expect(dialog.locator('pre')).toContainText('"id": "whale-buffet"');
	await noSidewaysScroll(page);
});

test('restricted characters stay out of the game, and the mode’s bans can be lifted', async ({
	page
}) => {
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	const restricted = page.getByRole('button', { name: /^Restricted characters/ });
	await expect(restricted).toContainText('(3)');
	await restricted.tap();
	const dialog = page.getByRole('dialog', { name: 'Restricted characters' });
	await dialog.getByRole('searchbox').fill('Pit-Hag');
	await dialog.getByRole('button', { name: /^Pit-Hag/ }).tap();
	await dialog.getByRole('searchbox').fill('Imp');
	await dialog.getByRole('button', { name: /^Imp\b/ }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(restricted).toContainText('(3)');

	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	const list = page.getByTestId('character-picker');
	// Every character is in the pool, less the restricted ones.
	await expect(list.getByRole('button', { name: 'Vortox', exact: true })).toBeVisible();
	await expect(list.getByRole('button', { name: 'Pit-Hag', exact: true })).toBeVisible();
	await expect(list.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0);
	await expect(list.getByRole('button', { name: 'Atheist', exact: true })).toHaveCount(0);
});
