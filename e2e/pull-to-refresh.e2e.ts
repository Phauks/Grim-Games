import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Pulling down refreshes ordinary pages (Trevor, 2026-10-16); a game in progress keeps it off,
// so a pull can't reload past the leave question. Headless Chromium can't perform the browser's
// pull gesture, so this checks the overscroll setting that allows or blocks it.

const pullDown = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY);

test('pulling down refreshes ordinary pages but not a game in progress', async ({ page }) => {
	for (const path of ['/', '/scripts', '/reference', '/play']) {
		await page.goto(path);
		expect(await pullDown(page), path).toBe('auto');
	}

	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect.poll(() => pullDown(page)).toBe('none');
});
