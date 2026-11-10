import { expect, test } from '@playwright/test';

// Live scan spike (Trevor, 2026-11-10: "build prototypes for both ... and then I decide"): the
// pretend camera's sheet is read while it is held still, and both ways of keeping the marks on
// the sheet run.
test.describe.configure({ timeout: 120_000 });

test('the demo sheet is read live, with marks that fade or follow the sheet', async ({ page }) => {
	await page.goto('/spikes/live-scan');
	const banner = page.getByTestId('live-scan-banner');
	await expect(banner).toContainText('Trouble Brewing', { timeout: 90_000 });
	await expect(banner).toContainText(/[1-9]\d* characters? read/);
	await expect(page.getByText('corners found')).toBeVisible();
	await page.getByText('Corner tracking', { exact: true }).tap();
	await expect(page.getByText('Marks follow the sheet by its corners')).toBeVisible();
	await page.getByRole('button', { name: /^Review/ }).tap();
	await expect(page.getByRole('dialog', { name: 'Trouble Brewing' })).toContainText('Washerwoman');
});
