import type { Page } from '@playwright/test';

/**
 * Waits until nothing on the page is mid-animation, such as a sheet sliding in. Endless loops
 * (the Dawn and Dusk art's glow, Trevor 2026-11-13) never finish, so they don't count.
 */
export async function animationsSettled(page: Page): Promise<void> {
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity)
	);
}
