import { expect, type Page } from '@playwright/test';

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
