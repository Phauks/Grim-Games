import { expect, type Page } from '@playwright/test';

/**
 * Opens Info tokens from the board's toolbar, or from More on a phone narrower than the
 * toolbar's eight buttons need, where it moved so the pane's button stays by the grim cover
 * (Trevor, 2026-11-15).
 */
export async function openInfoTokens(page: Page) {
	const button = page.getByRole('button', { name: 'Info tokens', exact: true });
	if (await button.isVisible()) await button.tap();
	else {
		await page.getByRole('button', { name: 'More', exact: true }).tap();
		await page.getByTestId('menu-info-tokens').tap();
	}
	await expect(page.getByRole('dialog', { name: 'Info tokens' })).toBeVisible();
}
