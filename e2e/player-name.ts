import { expect, type Page } from '@playwright/test';

/**
 * Sets this phone's name from the open Your settings sheet: the name row's pencil opens its
 * own modal with Save (Trevor, 2026-10-27), which closes back onto the sheet.
 */
export async function setPlayerName(phone: Page, name: string) {
	const you = phone.getByRole('dialog', { name: 'Your settings' });
	await you.getByRole('button', { name: 'Edit your name' }).tap();
	const modal = phone.getByRole('dialog', { name: 'Your name' });
	await modal.getByRole('textbox', { name: 'Your name' }).fill(name);
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();
}
