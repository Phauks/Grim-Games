import { expect, type Page } from '@playwright/test';

/**
 * Opens the Storyteller's Messages from the board's ⋯, where it is on every screen (Trevor,
 * 2026-10-28).
 */
export async function openInbox(page: Page) {
	await page.getByRole('button', { name: /^More/ }).tap();
	await page.getByTestId('menu-messages').tap();
	const inbox = page.getByRole('dialog', { name: 'Messages' });
	await expect(inbox).toBeVisible();
	return inbox;
}
