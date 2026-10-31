import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// The screen shown while a saved game opens: centred with the loading spinner, and ☰ in the
// board toolbar's spot as its way back (Trevor, 2026-10-31).

test('opening a game shows the spinner centred and the menu, then the board', async ({
	page
}, info) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	const url = page.url();

	// Holds the character data back so the opening screen stays up.
	let release = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/data/roles.json', async (route) => {
		await held;
		await route.continue();
	});
	await page.goto(url);

	const opening = page.locator('main[aria-busy="true"]');
	const text = opening.getByText('Opening the game…');
	await expect(text).toBeVisible();
	await expect(opening.getByTestId('game-opening')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

	// Centred on the screen, not tucked into a corner.
	const view = page.viewportSize()!;
	const box = (await text.boundingBox())!;
	expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(view.width * 0.05);
	expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(view.height * 0.1);
	// Nothing scrolls while it shows.
	expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(
		view.height
	);
	await page.screenshot({ path: test.info().outputPath(`opening-${info.project.name}.png`) });

	release();
	await expect(page.getByTestId('seat')).toHaveCount(8);
});
