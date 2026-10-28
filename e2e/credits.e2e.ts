import { expect, test } from '@playwright/test';
import { theMenu } from './shell.ts';

// Trevor (2026-10-28): the credits get their own page in the menu, not a part of About.

test('Credits sits beneath About and holds the credits About used to', async ({ page }) => {
	await page.goto('/');
	const menu = await theMenu(page);
	await menu
		.getByRole('list', { name: 'App', exact: true })
		.getByRole('link', { name: 'Credits', exact: true })
		.click();
	await expect(page).toHaveURL(/\/credits$/);
	const main = page.getByRole('main');
	await expect(main.getByRole('heading', { level: 1, name: 'Credits' })).toBeVisible();
	await expect(main.locator('.official-notice')).toContainText('Community Created Content policy');
	// The recordings' sources, open on their own page.
	await expect(main.getByRole('heading', { name: 'Sound credits' })).toBeVisible();
	await expect(main.locator('.credits li').first()).toBeVisible();

	// About no longer holds them.
	await page.goto('/about');
	await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
	await expect(page.getByRole('main').locator('.official-notice')).toHaveCount(0);
	await expect(page.getByRole('main').getByText('Sound credits')).toHaveCount(0);
});
