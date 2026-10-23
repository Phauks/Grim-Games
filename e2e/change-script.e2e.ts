import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Changing the script from inside a game (Trevor, 2026-10-23: "you started to make trouble
// brewing, but then wanna switch to a different script with the same players").

async function openGameInfo(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) return entry.tap();
	await page.keyboard.press('Escape');
	await expect(more).toBeHidden();
	await page.getByTestId('mode-menu').tap();
}

test('Game info’s pencil swaps the script, keeping the seats and their characters', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	// Seat 1 is named and has a Trouble Brewing character.
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

	await openGameInfo(page);
	const info = page.getByRole('dialog', { name: 'Game info', exact: true });
	await info.getByTestId('game-info-edit').tap();
	const edit = page.getByRole('dialog', { name: 'Edit game info' });
	// The same picker as New game, on the game's own script.
	const scripts = edit.getByRole('radiogroup', { name: 'Script' });
	await expect(scripts.getByRole('radio', { name: 'Trouble Brewing' })).toBeChecked();
	await scripts.getByText('Bad Moon Rising', { exact: true }).tap();
	await edit.getByRole('button', { name: 'Confirm' }).tap();
	await expect(edit).toBeHidden();

	// The new script, the same seats; the character it lacks stays, with one note (warn,
	// never lock).
	await expect(page.getByTestId('script-title')).toContainText('Bad Moon Rising');
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await expect(
		page.locator('[data-testid="seat"][aria-label^="Seat 1: Ana, Washerwoman"]')
	).toBeAttached();
	await expect(page.getByRole('status').filter({ hasText: 'Note' })).toContainText(
		'Washerwoman is not on the script.'
	);

	// It is kept: a reload opens the game on the new script.
	await page.reload();
	await expect(page.getByTestId('script-title')).toContainText('Bad Moon Rising');
});

test('Cancel in Game info’s pencil leaves the script as it was', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await openGameInfo(page);
	await page
		.getByRole('dialog', { name: 'Game info', exact: true })
		.getByTestId('game-info-edit')
		.tap();
	const edit = page.getByRole('dialog', { name: 'Edit game info' });
	await edit
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Sects & Violets', { exact: true })
		.tap();
	await edit.getByRole('button', { name: 'Cancel' }).tap();
	await expect(edit).toBeHidden();
	await expect(page.getByTestId('script-title')).toContainText('Trouble Brewing');
});
