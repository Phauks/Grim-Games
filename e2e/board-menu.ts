import { expect, type Locator, type Page } from '@playwright/test';
import { openPane } from './players.ts';

/** Opens the Soundboard: the pane's More, Sounds (Trevor, 2026-11-18), and returns it. */
export async function openSoundboard(page: Page): Promise<Locator> {
	const pane = await openPane(page, 'Sounds');
	const sounds = pane.getByTestId('pane-sounds');
	await expect(sounds).toBeVisible();
	return sounds;
}
