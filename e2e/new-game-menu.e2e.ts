import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

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

	// Ended: New game is where End game was, and opens straight away.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(menu.getByRole('button', { name: 'End game' })).toHaveCount(0);
	await expect(menu.getByRole('button').last()).toHaveText('New game');
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
