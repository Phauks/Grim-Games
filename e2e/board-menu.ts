import type { Page } from '@playwright/test';

/** Opens the Soundboard from the board's ⋯ menu, where it is a full row (Trevor, 2026-11-01). */
export async function openSoundboard(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Soundboard', exact: true })
		.tap();
}
