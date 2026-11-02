import { expect, type Page } from '@playwright/test';

/**
 * Add seat asks "Add as a Traveller?" once the seat is placed (Trevor, 2026-11-02); this
 * answers Not a Traveller, leaving an ordinary seat.
 */
export async function notATraveller(page: Page) {
	const ask = page.getByRole('dialog', { name: 'Add as a Traveller?' });
	await ask.getByRole('button', { name: 'Not a Traveller' }).tap();
	await expect(ask).toBeHidden();
}
