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
 * Opens Players at one player: their line tapped, so their messages, notes and reported
 * picture show beside the list (below it on a phone) (Trevor, 2026-11-01).
 */
export async function openPlayerSheet(page: Page, name: string) {
	const players = await openPlayers(page);
	const row = players.getByTestId('room-player').filter({ hasText: name });
	await row.getByRole('button').tap();
	await expect(row.getByRole('button')).toHaveAttribute('aria-current', 'true');
	const sheet = players.getByTestId('room-player-sheet');
	await expect(sheet).toBeVisible();
	return sheet;
}
