import { expect, test } from '@playwright/test';
import { theMenu } from './shell.ts';

// Trevor (2026-10-26): a Support page beneath About, with a Ko-fi link.

test('Support sits beneath About and holds the Ko-fi button', async ({ page }) => {
	await page.goto('/');
	const menu = await theMenu(page);
	const app = menu.getByRole('list', { name: 'App', exact: true }).getByRole('link');
	await expect(app).toHaveText(['About', 'Support', 'Changelog', 'Roadmap', 'Privacy']);
	await app.filter({ hasText: 'Support' }).click();
	await expect(page).toHaveURL(/\/support$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
	// No link yet: the button shows in place, disabled.
	await expect(page.getByRole('button', { name: 'Support on Ko-fi' })).toBeDisabled();
});
