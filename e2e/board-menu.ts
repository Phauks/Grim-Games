import { expect, type Locator, type Page } from '@playwright/test';
import { openPane } from './players.ts';
import { openSettingsDialog } from './shell.ts';

/** Opens the pane's More, Sounds (Trevor, 2026-11-18), and returns it. */
export async function openSoundboard(page: Page): Promise<Locator> {
	const pane = await openPane(page, 'Sounds');
	const sounds = pane.getByTestId('pane-sounds');
	await expect(sounds).toBeVisible();
	return sounds;
}

/** Picks a sound in the pane's Sounds and plays it (Trevor, 2026-11-19, D). */
export async function playSound(page: Page, name: string): Promise<Locator> {
	const sounds = await openSoundboard(page);
	const pick = sounds.getByRole('combobox', { name: 'Sound', exact: true });
	await pick.tap();
	await page.getByRole('option', { name, exact: true }).tap();
	await expect(pick).toContainText(name);
	await sounds.getByRole('button', { name: 'Play', exact: true }).tap();
	return sounds;
}

/** Opens Settings at Sound, over the board, and returns the dialog. */
export async function openSoundSettings(page: Page): Promise<Locator> {
	const settings = await openSettingsDialog(page);
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	return settings;
}
