import { expect, type Page } from '@playwright/test';

/**
 * Opens the Storyteller's Players from the board's ⋯, where it is on every screen (Trevor,
 * 2026-10-29: Messages folded into Players).
 */
export async function openPlayers(page: Page) {
	await page.getByRole('button', { name: /^More/ }).tap();
	await page.getByTestId('menu-players').tap();
	const players = page.getByRole('dialog', { name: 'Players', exact: true });
	await expect(players).toBeVisible();
	return players;
}

/** Opens one player's sheet on Players, with their messages and reported picture. */
export async function openPlayerSheet(page: Page, name: string) {
	const players = await openPlayers(page);
	await players
		.getByTestId('room-player')
		.filter({ hasText: name })
		.getByTestId('room-player-open')
		.tap();
	const sheet = page.getByRole('dialog', { name, exact: true });
	await expect(sheet.getByTestId('room-player-sheet')).toBeVisible();
	return sheet;
}
