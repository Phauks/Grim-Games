import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// A new script means a new game, never a change mid-game (Trevor, 2026-10-24): New game in
// the board's ⋯ menu opens "a tiny modal version of the new game screen", and the room, seat
// count and player names carry over. It was in Game info until 2026-10-26, and is on ⋯ only
// once the game has ended, in End game's place (Trevor, 2026-10-26).

async function openGameInfo(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	return page.getByRole('dialog', { name: 'Game info', exact: true });
}

/** Ends the game from ⋯, with Good winning. */
async function endGame(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
}

/** New game is in the board's ⋯ menu once the game has ended (Trevor, 2026-10-26). */
async function newGameFromMenu(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'New game' })
		.tap();
}

async function startTroubleBrewing(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
}

test('New game in the board menu, once the game ends, starts the next game with the same players', async ({
	page
}) => {
	await startTroubleBrewing(page);
	const board = page.url();
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Ana');
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Ana' })
		.getByRole('button', { name: 'Washerwoman', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// Game info has no New game, and no pencil (the Storyteller is the Profile's name).
	const info = await openGameInfo(page);
	await expect(info.getByRole('button', { name: 'New game' })).toHaveCount(0);
	await expect(info.getByTestId('game-info-edit')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(info).toBeHidden();

	// The game is ended first; New game then opens with nothing to ask.
	await endGame(page);
	await newGameFromMenu(page);
	await expect(page.getByRole('alertdialog', { name: 'Start a new game?' })).toHaveCount(0);
	// New game in a sheet over the board: script, mode and room vote, and the same script
	// preview as the New game screen (Trevor, 2026-10-24).
	const newGame = page.getByRole('dialog', { name: 'New game' });
	// Its Room vote opens over the board, not /vote (Trevor, 2026-11-01, plan J43).
	await newGame.getByRole('button', { name: 'Room vote' }).tap();
	const vote = page.getByRole('dialog', { name: 'Room vote' });
	await expect(vote.getByRole('heading', { name: 'Vote on the next script' })).toBeVisible();
	expect(page.url()).toBe(board);
	await vote.getByRole('button', { name: 'Close' }).tap();
	await expect(vote).toHaveCount(0);
	const preview = newGame.getByTestId('script-preview');
	await expect(preview).toContainText('Washerwoman');
	await newGame
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Bad Moon Rising', { exact: true })
		.tap();
	await expect(preview).toContainText('Grandmother');
	await newGame.getByRole('button', { name: 'Create game' }).tap();

	// Character selection of the next game, then its board: the same seats and names.
	await toBoard(page);
	expect(page.url()).not.toBe(board);
	await expect(page.getByTestId('script-title')).toContainText('Bad Moon Rising');
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 1: Ana"]')).toBeAttached();

	// The old game is over, in History, and stays on its own script.
	await page.goto(board);
	await expect(page.getByTestId('script-title')).toContainText('Trouble Brewing');
	await expect(page.getByTestId('game-over')).toBeVisible();
});

test('closing New game from an ended game changes nothing', async ({ page }) => {
	await startTroubleBrewing(page);
	// Character selection is on ⋯ until Start game.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(more.getByRole('button', { name: 'Character selection' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(more).toBeHidden();

	await endGame(page);
	await newGameFromMenu(page);
	const newGame = page.getByRole('dialog', { name: 'New game' });
	await expect(newGame).toBeVisible();
	await newGame.getByRole('button', { name: 'Close' }).tap();
	await expect(newGame).toBeHidden();
	await expect(page.getByTestId('script-title')).toContainText('Trouble Brewing');
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
});

test('players carry only into the game started from that sheet, never a later one', async ({
	page
}) => {
	await startTroubleBrewing(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Ana');
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	const board = page.url();

	// The sheet is left without starting or closing it: a reload, or leaving the board.
	await endGame(page);
	await newGameFromMenu(page);
	await expect(page.getByRole('dialog', { name: 'New game' })).toBeVisible();
	await page.reload();

	// A brand-new game from New game starts with no names, and the old game stays as it was.
	await startTroubleBrewing(page);
	expect(page.url()).not.toBe(board);
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 1:"]')).toBeAttached();
	await expect(page.locator('[data-testid="seat"][aria-label*="Ana"]')).toHaveCount(0);
	await page.goto(board);
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
});
