import { expect, type Page } from '@playwright/test';

/**
 * Opens the Storyteller's Messages from the board: the toolbar's button on a tablet, ⋯ on a
 * phone, where the toolbar has no room for it (Trevor, 2026-10-27).
 */
export async function openInbox(page: Page) {
	const onToolbar = page.getByTestId('toolbar-messages');
	if (await onToolbar.isVisible()) await onToolbar.tap();
	else {
		await page.getByRole('button', { name: /^More/ }).tap();
		await page.getByTestId('menu-messages').tap();
	}
	const inbox = page.getByRole('dialog', { name: 'Messages' });
	await expect(inbox).toBeVisible();
	return inbox;
}
