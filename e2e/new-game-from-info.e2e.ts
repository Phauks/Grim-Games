import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// A new script means a new game, never a change mid-game (Trevor, 2026-10-24): Game info's
// New game opens "a tiny modal version of the new game screen", and the room, seat count
// and player names carry over.

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

async function startTroubleBrewing(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
}

test('New game in Game info asks first, then starts the next game with the same players', async ({
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

	// The pencil no longer changes the script.
	let info = await openGameInfo(page);
	await info.getByTestId('game-info-edit').tap();
	const edit = page.getByRole('dialog', { name: 'Edit game info' });
	await expect(edit.getByRole('radiogroup', { name: 'Script' })).toHaveCount(0);
	await edit.getByRole('button', { name: 'Cancel' }).tap();

	// A game under way is ended only after asking; Cancel keeps it.
	info = await openGameInfo(page);
	await info.getByTestId('game-info-new-game').tap();
	const ask = page.getByRole('alertdialog', { name: 'Start a new game?' });
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(ask).toBeHidden();
	await expect(page.getByRole('dialog', { name: 'New game' })).toHaveCount(0);

	info = await openGameInfo(page);
	await info.getByTestId('game-info-new-game').tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// New game in a sheet over the board: script, mode and room vote, and the same script
	// preview as the New game screen (Trevor, 2026-10-24).
	const newGame = page.getByRole('dialog', { name: 'New game' });
	await expect(newGame.getByRole('button', { name: 'Room vote' })).toBeVisible();
	const preview = newGame.getByTestId('script-preview');
	await expect(preview).toContainText('Washerwoman');
	await newGame
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Bad Moon Rising', { exact: true })
		.tap();
	await expect(preview).toContainText('Grandmother');
	await newGame.getByRole('button', { name: 'Start game' }).tap();

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

test('before anything happens, New game opens straight away and closing it changes nothing', async ({
	page
}) => {
	await startTroubleBrewing(page);
	// Character selection is on ⋯ until Start game.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(more.getByRole('button', { name: 'Character selection' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(more).toBeHidden();

	const info = await openGameInfo(page);
	await info.getByTestId('game-info-new-game').tap();
	await expect(page.getByRole('alertdialog', { name: 'Start a new game?' })).toHaveCount(0);
	const newGame = page.getByRole('dialog', { name: 'New game' });
	await expect(newGame).toBeVisible();
	await newGame.getByRole('button', { name: 'Close' }).tap();
	await expect(newGame).toBeHidden();
	await expect(page.getByTestId('script-title')).toContainText('Trouble Brewing');
	await expect(page.getByTestId('game-over')).toHaveCount(0);

	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await more.getByRole('button', { name: 'Character selection' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
});
