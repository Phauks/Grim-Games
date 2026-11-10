import { expect, test } from '@playwright/test';

// Live scan spike (Trevor, 2026-11-10): the pretend camera's sheet, held with a hand's shake,
// is frozen once its corners are steady, straightened into a flat page and read; the marks
// then follow the sheet by its corners. The fade-while-moving way stays behind the switch.
test.describe.configure({ timeout: 120_000 });

test('a shaky sheet is frozen, straightened and read, its marks following the sheet', async ({
	page
}) => {
	await page.goto('/spikes/live-scan');
	const banner = page.getByTestId('live-scan-banner');
	await expect(banner).toContainText('Trouble Brewing', { timeout: 90_000 });
	await expect(banner).toContainText(/[1-9]\d* characters? read/);
	await expect(page.getByTestId('live-scan-page')).toBeVisible();
	await expect(page.getByText('corners found')).toBeVisible();
	await page.getByRole('button', { name: /^Review/ }).tap();
	await expect(page.getByRole('dialog', { name: 'Trouble Brewing' })).toContainText('Washerwoman');
	await page.keyboard.press('Escape');
	await page.getByText('Corner tracking', { exact: true }).tap();
	await expect(page.getByText('Off: marks fade while the picture moves')).toBeVisible();
});
