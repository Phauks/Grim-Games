import type { Page } from '@playwright/test';
import { openPane } from './players.ts';

/**
 * Seating mode on the board (seating-mode.svelte.ts): the pane's More, Seats, Seating, unless it is open already.
 * Add seat lives only in its bar (Trevor, 2026-11-01).
 */
export async function enterSeating(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	if (await toolbar.getByRole('button', { name: 'Add seat' }).count()) return;
	const pane = await openPane(page, 'Seats');
	await pane.getByTestId('menu-seating').tap();
}

/** Seating's Done. */
export async function leaveSeating(page: Page): Promise<void> {
	await page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button', { name: 'Done' }).tap();
}

/**
 * Adds a seat from Seating, placed at the spot named `place` ("Place between ..."), then leaves
 * Seating unless `stay`.
 */
export async function addSeat(
	page: Page,
	place: string | RegExp,
	{ stay = false }: { stay?: boolean } = {}
): Promise<void> {
	await enterSeating(page);
	await page
		.getByRole('toolbar', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add seat' })
		.tap();
	await page.getByRole('button', { name: place }).tap();
	if (!stay) await leaveSeating(page);
}
