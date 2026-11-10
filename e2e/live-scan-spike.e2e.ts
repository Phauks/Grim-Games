import { expect, test } from '@playwright/test';

// Live scan spike (Trevor, 2026-11-10): the pretend camera's sheet, held with a hand's shake,
// is grabbed once its corners are steady, straightened into a flat page and read once; the
// frame is then held and the review opens, asking for a scan again only when something looked
// wrong. Take picture grabs at once. The fade-while-moving way stays behind the switch.
test.describe.configure({ timeout: 120_000 });

test('a shaky sheet is grabbed once, straightened and read, then held for review', async ({
	page
}) => {
	await page.goto('/spikes/live-scan');
	const review = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(review).toContainText('Washerwoman', { timeout: 90_000 });
	await expect(page.getByTestId('live-scan-page')).toBeVisible();
	await expect(page.getByText('1 reads')).toBeVisible();
	await page.keyboard.press('Escape');
	// Held: no second read starts.
	await page.waitForTimeout(3000);
	await expect(page.getByText('1 reads')).toBeVisible();
	await expect(page.getByTestId('live-scan-status')).toHaveText(/^Read/);
	await page.getByRole('button', { name: 'Scan again' }).last().tap();
	await expect(page.getByTestId('live-scan-banner')).toHaveText('Nothing read yet');
	// A picture taken by hand (Trevor, 2026-11-10), in case the auto-grab has difficulties.
	await page.getByRole('button', { name: 'Take picture' }).tap();
	await expect(review).toContainText('Washerwoman', { timeout: 30_000 });
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Scan again' }).last().tap();
	await page.getByText('Corner tracking', { exact: true }).tap();
	await expect(page.getByText('Off: marks fade while the picture moves')).toBeVisible();
});
