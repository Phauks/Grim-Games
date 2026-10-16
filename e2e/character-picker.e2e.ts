import { expect, test } from '@playwright/test';

// The shared character picker: type groups close from their header like a caret menu.

test('the seat character picker has collapsible type groups; search shows every match', async ({
	page
}) => {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });

	const townsfolk = picker.getByRole('button', { name: 'Townsfolk', exact: true });
	const washerwoman = picker.getByRole('button', { name: 'Washerwoman', exact: true });
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'true');
	await townsfolk.tap();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
	await expect(washerwoman).toBeHidden();
	await expect(picker.getByRole('button', { name: 'Imp', exact: true })).toBeVisible();

	// A search shows matches in closed groups too, then the group closes again.
	const search = picker.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('wash');
	await expect(washerwoman).toBeVisible();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'true');
	await search.fill('');
	await expect(washerwoman).toBeHidden();

	// Remembered on this device.
	await page.keyboard.press('Escape');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
});
