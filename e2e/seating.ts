import type { Page } from '@playwright/test';

/**
 * Seating mode on the board (seating-mode.svelte.ts): ⋯ > Seating, unless it is open already.
 * Add seat lives only in its bar (Trevor, 2026-11-01).
 */
export async function enterSeating(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Grimoire' });
	if (await toolbar.getByRole('button', { name: 'Add seat' }).count()) return;
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Seating', exact: true })
		.tap();
}

/** Seating's Done. */
export async function leaveSeating(page: Page): Promise<void> {
	await page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button', { name: 'Done' }).tap();
}

/**
 * Adds a seat from Seating, placed at the spot named `place` ("Place between ..."), then leaves
 * Seating unless `stay` (something such as Travellers choose opens over it first).
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
