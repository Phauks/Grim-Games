import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { menuButton } from './shell.ts';

// Trevor (2026-10-23): the sidebar's hamburger was not where the board's was. It now has one
// spot on every screen (--menu-inset from the top left), and the drawer's close button takes
// the same spot, so the menu closes where it opened.

/** Where the visible hamburger is, rounded to whole pixels. */
async function spot(page: Page, name = 'Menu') {
	const button = page.getByRole('button', { name, exact: true }).filter({ visible: true });
	await expect(button).toHaveCount(1);
	const box = (await button.boundingBox())!;
	return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) };
}

async function startGame(page: Page) {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await toBoard(page);
	await expect(page.getByTestId('seat').first()).toBeVisible();
}

test('the hamburger is in one spot on every screen', async ({ page }) => {
	await page.goto('/library');
	const home = await spot(page);
	expect(home.width).toBeGreaterThanOrEqual(44);
	// The title starts after it, level with it.
	const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
	expect(title.x).toBeGreaterThanOrEqual(home.x + home.width);
	expect(Math.abs(title.y + title.height / 2 - (home.y + 22))).toBeLessThan(6);

	for (const path of ['/', '/reference', '/account']) {
		await page.goto(path);
		expect(await spot(page)).toEqual(home);
	}
	await page.goto('/play');
	expect(await spot(page)).toEqual(home);

	await menuButton(page).tap();
	// Once the drawer has slid in.
	await expect.poll(() => spot(page, 'Close menu')).toEqual(home);
	await page.keyboard.press('Escape');

	await startGame(page);
	expect(await spot(page)).toEqual(home);
});

test.describe('on a computer', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('the sidebar, a closed sidebar and a game share the spot', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one computer run is enough');
		await page.goto('/library');
		const open = await spot(page);
		await menuButton(page).click();
		await expect(page.getByRole('navigation', { name: 'Menu', exact: true })).toBeHidden();
		expect(await spot(page)).toEqual(open);
		await menuButton(page).click();
		await startGame(page);
		expect(await spot(page)).toEqual(open);
	});
});
