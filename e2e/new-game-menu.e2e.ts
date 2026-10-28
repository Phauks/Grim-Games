import { expect, test } from '@playwright/test';
import { pickScript, toBoard, pastGameSettings } from './new-game.ts';

// Trevor's playtest (2026-10-26): Game info's New game moves into the board's ⋯ menu, where
// it replaces End game once the game has ended. The sidebar keeps its own New game.

test("New game takes End game's place in the board ⋯ menu once the game ends", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	// While the game is in play the menu ends it, and has no New game.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(menu.getByRole('button', { name: 'New game' })).toHaveCount(0);
	await menu.getByRole('button', { name: 'End game' }).tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');

	// Ended: New game is where End game was, at the foot of the Game group (Trevor,
	// 2026-10-27), and opens straight away.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(menu.getByRole('button', { name: 'End game' })).toHaveCount(0);
	await expect(
		menu.getByRole('region', { name: 'Game', exact: true }).getByRole('button').last()
	).toHaveText('New game');
	await menu.getByRole('button', { name: 'New game' }).tap();
	await expect(page.getByRole('alertdialog', { name: 'Start a new game?' })).toHaveCount(0);
	await expect(
		page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: 'Start game' })
	).toBeVisible();
});

test('typing a custom script name brings the search to the top, so its picks open below', async ({
	page
}) => {
	await page.goto('/new');
	const search = page.getByPlaceholder('Find a script');
	await search.tap();
	await expect
		.poll(async () => (await search.boundingBox())?.y ?? Infinity)
		.toBeLessThan(page.viewportSize()!.height / 4);
	await expect(
		page.getByRole('radiogroup', { name: 'Script' }).getByRole('radio', { name: 'Custom' })
	).toBeChecked();
});

// Trevor (2026-10-27): once the bag is dealt, Character selection did nothing from ⋯ (the
// selection screen sends a set-up game straight back), so it is no longer offered; unavailable
// items stay hidden rather than greyed.
test('the board ⋯ menu offers Character selection only until the bag is dealt', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await pastGameSettings(page);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	const selection = menu.getByRole('button', { name: 'Character selection' });

	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(selection).toBeVisible();
	await page.keyboard.press('Escape');

	await page.goto(`${board}/setup`);
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]')).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await page.getByRole('button', { name: 'Deal' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Deal at random?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('button', { name: 'Deal' })).toBeDisabled();

	// A full reload skips the flush that in-app navigation does, so the deal may still be
	// saving on a slow runner: reload until it has landed.
	await expect(async () => {
		await page.goto(board);
		await page.getByRole('button', { name: 'More', exact: true }).tap();
		await expect(menu.getByRole('button', { name: 'History' })).toBeVisible();
		await expect(selection).toHaveCount(0, { timeout: 1000 });
	}).toPass();
});
