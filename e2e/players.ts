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

/**
 * Opens Players at one player: their caret section, with their notes, messages and reported
 * picture beneath them (Trevor, 2026-10-31).
 */
export async function openPlayerSheet(page: Page, name: string) {
	const players = await openPlayers(page);
	const player = players.getByTestId('room-player').filter({ hasText: name });
	await expect(player.getByTestId('room-player-sheet')).toBeVisible();
	return player;
}
