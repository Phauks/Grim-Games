import { expect, type Page } from '@playwright/test';

/**
 * Opens Settings > Player from the player screen's cog, which opens the one Settings at its
 * list of sections (Trevor, 2026-10-27: one Settings everywhere). In a room, the section
 * starts with this phone's name.
 */
export async function openPlayerSettings(phone: Page) {
	await phone.getByTestId('you-button').tap();
	const settings = phone.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player', exact: true })
		.tap();
	await expect(settings.getByRole('heading', { name: 'Player', level: 2 })).toBeVisible();
	return settings;
}

/**
 * Opens this phone's Profile (name, picture, laurel) from the button beside Settings' X
 * (Trevor, 2026-10-27), with Settings open over its room.
 */
export async function openProfile(phone: Page) {
	await phone.getByTestId('you-button').tap();
	const settings = phone.getByRole('dialog', { name: 'Settings' });
	await settings.getByRole('button', { name: 'Profile', exact: true }).tap();
	await expect(settings.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
	return settings;
}

/**
 * Sets this phone's name from its Profile, open over its room: the name row's pencil
 * opens its own modal with Save (Trevor, 2026-10-27), which closes back onto Settings.
 */
export async function setPlayerName(phone: Page, name: string) {
	const settings = phone.getByRole('dialog', { name: 'Settings' });
	await settings.getByRole('button', { name: 'Edit your name' }).tap();
	const modal = phone.getByRole('dialog', { name: 'Your name' });
	await modal.getByRole('textbox', { name: 'Your name' }).fill(name);
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();
}
