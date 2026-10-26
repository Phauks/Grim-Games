import { expect, test } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

// Trevor (2026-10-25): a Language section in Settings, English the only choice for now.
test('Settings has a Language section offering English only', async ({ page }) => {
	await page.goto('/');
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Language' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Language', level: 2 })).toBeVisible();
	const select = dialog.getByRole('combobox', { name: 'Language' });
	await expect(select).toHaveText(/English/);
	await select.tap();
	await expect(page.getByRole('option')).toHaveText(['English']);
	await page.getByRole('option', { name: 'English' }).tap();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
