import { expect, type Page } from '@playwright/test';

/** Opens Info tokens from the board's toolbar, where it always shows since ⋯ left it. */
export async function openInfoTokens(page: Page) {
	await page.getByRole('button', { name: 'Info tokens', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Info tokens' })).toBeVisible();
}
