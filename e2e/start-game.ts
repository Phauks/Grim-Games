import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Taps Start game and confirms "Start the game?" when it asks: it does with setup reminders
 * still to place, or with seats that have no character (Trevor, 2026-11-01: warn, never lock).
 */
export async function tapStartGame(page: Page, start: Locator) {
	await start.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect.poll(async () => (await ask.isVisible()) || (await start.count()) === 0).toBe(true);
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}
