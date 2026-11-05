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
	await expect(main.getByRole('heading', { name: 'Sound credits' })).toBeVisible();

	// About no longer holds them.
	await page.goto('/about');
	await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
	await expect(page.getByRole('main').locator('.official-notice')).toHaveCount(0);
	await expect(page.getByRole('main').getByText('Sound credits')).toHaveCount(0);
});

// Trevor (2026-11-05): "make sound credit menus and other potential credit menus in that
// area collapsible". Each list starts closed with its count, opens from its header, and
// stays as it was left.
test('Each credit list opens and closes from its header and is remembered', async ({ page }) => {
	await page.goto('/credits');
	const main = page.getByRole('main');
	const sound = main.getByRole('button', { name: /^Sound credits/ });
	const day = main.getByRole('button', { name: /^Day and night sound/ });
	const board = main.getByRole('button', { name: /^Soundboard/ });
	await expect(sound).toHaveAttribute('aria-expanded', 'true');
	await expect(day).toHaveAttribute('aria-expanded', 'false');
	await expect(board).toHaveAttribute('aria-expanded', 'false');
	await expect(main.locator('.credits li').first()).toBeHidden();

	await day.click();
	await expect(day).toHaveAttribute('aria-expanded', 'true');
	await expect(main.locator('.credits li').first()).toBeVisible();

	await page.reload();
	await expect(day).toHaveAttribute('aria-expanded', 'true');
	await expect(board).toHaveAttribute('aria-expanded', 'false');

	await sound.click();
	await expect(sound).toHaveAttribute('aria-expanded', 'false');
	await expect(day).toBeHidden();
});
