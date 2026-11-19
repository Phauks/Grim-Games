import { expect, type Locator, type Page } from '@playwright/test';
import { openPane } from './players.ts';

/**
 * Opens one band of Theme, the board's looks, which left Settings for the game (Trevor,
 * 2026-11-18): from the player screen's settings cog on /play, as a phone with no game open
 * reaches it. The band opens alone (one at a time); returns the Theme sheet.
 */
export async function openTheme(page: Page, band: string) {
	const cog = page.getByTestId('you-button');
	if (!new URL(page.url()).pathname.startsWith('/play')) {
		await page.goto('/play');
		// No script yet: the base three are offered; the first load fetches the character
		// data, slow on a busy machine.
		const script = page.getByRole('button', { name: 'Trouble Brewing' });
		await expect(script.or(cog).first()).toBeVisible({ timeout: 15_000 });
		if (!(await cog.isVisible())) await script.tap();
	}
	await expect(cog).toBeVisible();
	await cog.tap();
	const theme = page.getByRole('dialog', { name: 'Theme', exact: true });
	const toggle = theme.getByRole('button', { name: band, exact: true });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	return theme;
}

/**
 * Opens one band of the Storyteller's Theme, the pane's More › Theme beside the board (Trevor,
 * 2026-11-18); returns the pane. On a phone the pane is a sheet over the board.
 */
export async function openBoardTheme(page: Page, band: string) {
	const pane = await openPane(page, 'Theme');
	const panel = pane.getByTestId('theme-panel');
	const toggle = panel.getByRole('button', { name: band, exact: true });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	return panel;
}

/** Opens one band in a Theme that is already open; the band before it closes. */
export async function openBand(theme: Locator, band: string) {
	const toggle = theme.getByRole('button', { name: band, exact: true });
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}
