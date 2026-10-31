import { expect, test } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

// Settings search (Trevor, 2026-10-27): one box over the section list finds a setting in any
// section by its name, description or section, and tapping a result opens it.

test('a search finds a setting in any section and opens it, marked', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettingsDialog(page);
	const search = dialog.getByTestId('settings-search');
	await expect(search).toBeVisible();

	await search.fill('text size');
	const results = dialog.getByTestId('settings-results');
	const hit = results.getByRole('button', { name: /^Text size\s*Text$/ });
	await expect(hit).toBeVisible();
	expect((await hit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
	// The section list is replaced while searching.
	await expect(
		dialog.getByRole('navigation').getByRole('button', { name: 'Theme', exact: true })
	).toHaveCount(0);

	await hit.tap();
	await expect(dialog.getByRole('heading', { name: 'Text', level: 2 })).toBeVisible();
	const row = dialog.locator('.content [data-search-label="Text size"]').first();
	await expect(row).toBeInViewport();
	await expect(row).toHaveAttribute('data-search-hit', '');
});

test('a setting in a closed group opens the group', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettingsDialog(page);
	await dialog.getByTestId('settings-search').fill('focus ring');
	await dialog
		.getByTestId('settings-results')
		.getByRole('button', { name: /^Focus ring\s*Theme$/ })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Theme', level: 2 })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Accents and buttons' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(dialog.locator('.content [data-search-label="Focus ring"]')).toBeInViewport();
});

test('nothing found says None, and clearing brings the sections back', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettingsDialog(page);
	const search = dialog.getByTestId('settings-search');
	await search.fill('zzzz');
	await expect(dialog.getByTestId('settings-results')).toHaveText('None');
	await search.fill('');
	await expect(
		dialog.getByRole('navigation').getByRole('button', { name: 'Theme', exact: true })
	).toBeVisible();
});
