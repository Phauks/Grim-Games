import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Trevor's playtest (2026-10-26): Game info's New game moves into the board's ⋯ menu, and
// the current game ends before a new one starts. The sidebar keeps its own New game.

async function fromMenu(page: Page, name: string) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name }).tap();
}

test('New game in the board ⋯ menu ends the game first', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	// A character is in play, so the game is under way.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const seat = page.locator('[data-scope="drawer"][data-part="content"]');
	await seat.getByRole('button', { name: 'Edit player name' }).tap();
	await seat.getByRole('textbox', { name: 'Player name' }).fill('Ana');
	await seat.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await seat.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Ana' })
		.getByRole('button', { name: 'Washerwoman', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seat).toBeHidden();

	// A game under way asks first; Cancel keeps it.
	await fromMenu(page, 'New game');
	const ask = page.getByRole('alertdialog', { name: 'Start a new game?' });
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page.getByRole('dialog', { name: 'New game' })).toHaveCount(0);
	await fromMenu(page, 'New game');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const newGame = page.getByRole('dialog', { name: 'New game' });
	await expect(newGame.getByRole('button', { name: 'Start game' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(newGame).toBeHidden();

	// An ended game has nothing left to end: New game opens straight away.
	await fromMenu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
	await fromMenu(page, 'New game');
	await expect(ask).toHaveCount(0);
	await expect(newGame.getByRole('button', { name: 'Start game' })).toBeVisible();
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
