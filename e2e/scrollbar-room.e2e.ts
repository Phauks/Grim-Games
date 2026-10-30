import { expect, test, type Page } from '@playwright/test';
import { chromiumPath } from '../scripts/lib/chromium-path.ts';
import { toBoard } from './new-game.ts';

// A laptop draws the page's scrollbar beside the page, not over it (Trevor, 2026-10-30): the
// board's scrollbar flickered in and out, and /play's tabs and candles moved between Grim and
// Script. Playwright hides scrollbars unless told not to, so this file shows them.

test.use({
	viewport: { width: 1366, height: 768 },
	isMobile: false,
	hasTouch: false,
	deviceScaleFactor: 1,
	launchOptions: { executablePath: chromiumPath(), ignoreDefaultArgs: ['--hide-scrollbars'] }
});

test.describe('on a laptop with a scrollbar beside the page', () => {
	test('/play tabs hold still between a screen that scrolls and one that does not', async ({
		page
	}) => {
		test.skip(test.info().project.name !== 'tablet', 'one laptop run is enough');
		await page.goto('/play');
		await page.getByRole('button', { name: 'Trouble Brewing' }).click();
		const tab = page.getByRole('tab', { name: 'Grim' });
		const left = async (name: string) => {
			await page.getByRole('tab', { name }).click();
			await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
			return (await tab.boundingBox())?.x;
		};
		// Script scrolls and Grim doesn't; Grim's tab stays where it was on both.
		const onScript = await left('Script');
		expect(await scrolls(page)).toBe(true);
		expect(await left('Grim')).toBe(onScript);
		expect(await left('Night')).toBe(onScript);
	});

	test('the board never shows a page scrollbar, even when something reaches past it', async ({
		page
	}) => {
		test.skip(test.info().project.name !== 'tablet', 'one laptop run is enough');
		await page.goto('/new');
		await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').click();
		await page.getByRole('button', { name: 'Create game' }).click();
		await toBoard(page);
		// A sliver past the bottom, as a rounding on a scaled laptop screen left.
		await page.evaluate(() => {
			const sliver = document.createElement('div');
			sliver.style.cssText = 'position: absolute; top: 0; width: 1px; height: 120vh';
			document.querySelector('.grimoire')?.append(sliver);
		});
		const width = () => page.evaluate(() => document.documentElement.clientWidth);
		expect(await width()).toBe(1366);
		await page.mouse.wheel(0, 400);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});
});

/** Whether the page is taller than the window. */
const scrolls = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
