import { expect, test, type Page } from '@playwright/test';

// Settings > Tokens (Trevor, 2026-10-16): character token and reminder sizes, token colours
// with a contrast readout. Stored on the device and applied everywhere tokens show.

async function openTokens(page: Page) {
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Tokens' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Tokens', level: 2 })).toBeVisible();
	return dialog;
}

const rootStyle = (page: Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test('token and reminder sizes apply to the tokens and stay after a reload', async ({ page }) => {
	await page.goto('/reference');
	const token = page.locator('[data-testid="reference-card"] .token').first();
	const reminder = page.getByTestId('reminder-token').first();
	await expect(token).toBeVisible();
	const before = (await token.boundingBox())!.width;
	const chipBefore = (await reminder.boundingBox())!.height;

	const dialog = await openTokens(page);
	await dialog
		.getByRole('radiogroup', { name: 'Character token size' })
		.getByText('XL', { exact: true })
		.tap();
	await dialog
		.getByRole('radiogroup', { name: 'Reminder token size' })
		.getByText('XL', { exact: true })
		.tap();
	expect(await rootStyle(page, '--token-scale')).toBe('1.5');
	expect(await rootStyle(page, '--reminder-scale')).toBe('1.5');
	await dialog.getByRole('button', { name: 'Close' }).tap();

	expect((await token.boundingBox())!.width).toBeCloseTo(before * 1.5, 0);
	expect((await reminder.boundingBox())!.height).toBeGreaterThan(chipBefore * 1.3);

	await page.reload();
	await expect(token).toBeVisible();
	expect((await token.boundingBox())!.width).toBeCloseTo(before * 1.5, 0);
});

test('a token colour can be changed, warns when hard to read, and resets', async ({ page }) => {
	await page.goto('/reference');
	const dialog = await openTokens(page);
	const contrast = dialog.getByTestId('token-contrast');
	await expect(contrast).toContainText('easy to read');
	const reset = dialog.getByRole('button', { name: 'Reset Token text' });
	await expect(reset).toBeDisabled();

	// Pale text on the pale faces is flagged, in place (no layout change).
	const box = (await contrast.boundingBox())!;
	await dialog.getByLabel('Token text', { exact: true }).fill('#eeeeee');
	await expect(contrast).toContainText('hard to read');
	expect((await contrast.boundingBox())!.height).toBeCloseTo(box.height, 0);
	expect(await rootStyle(page, '--on-reminder')).toBe('#eeeeee');

	await reset.tap();
	await expect(contrast).not.toContainText('hard to read');
	expect(await rootStyle(page, '--on-reminder')).not.toBe('#eeeeee');
});
