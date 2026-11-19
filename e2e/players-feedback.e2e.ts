import { expect, test } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { closePane, openPane, openPlayers, paneButton } from './players.ts';

// Players is one column of pill sections (Trevor, 2026-11-17, "A"): Players with Show's eye on
// its pill, then Spectators. Each player's row opens to their controls and messages beneath it
// (Trevor, 2026-11-19: "Turn player players into just messages"). Player feedback is in
// Session once the game is over, unseen during it (Trevor, 2026-11-19: "We shouldn't even see
// player feedback section during the game").

test('Player feedback is in Session once the game is over, never on Players', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const gameId = new URL(page.url()).pathname.split('/').at(-1)!;

	let players = await openPlayers(page);
	const sections = players.getByTestId('players-room').getByRole('heading', { level: 2 });
	const names = [/^Players/, /^Spectators/];
	await expect(sections).toHaveCount(names.length);
	for (const [n, name] of names.entries())
		await expect(sections.nth(n).getByRole('button').first()).toHaveAccessibleName(name);
	// Show characters is an eye on the Players pill, with no word on it.
	const show = players.getByTestId('roles-show');
	await expect(show).toHaveAccessibleName('Show characters');
	await expect(show).toHaveText('');
	// The eye is the colour of the pill's own words (Trevor, 2026-11-18).
	const words = players.getByRole('button', { name: /^Players/ }).first();
	const colour = await words.evaluate((el) => getComputedStyle(el).color);
	await expect(show).toHaveCSS('color', colour);
	// A player's row opens beneath it, with no other player's showing, and no notes in it.
	await expect(players.getByTestId('room-player-sheet')).toHaveCount(0);
	const row = players.getByTestId('room-player').first();
	await row.getByRole('button').first().tap();
	await expect(row.getByTestId('room-player-sheet')).toBeVisible();
	await expect(row.getByRole('button', { name: /^Notes/ })).toHaveCount(0);
	await expect(players.getByTestId('room-player-sheet')).toHaveCount(1);
	await expect(page.getByRole('button', { name: /^Player feedback/ })).toHaveCount(0);
	// Nor in Session while the game goes on.
	const session = await openPane(page, 'Session');
	await expect(session.getByRole('button', { name: /^Player feedback/ })).toHaveCount(0);
	await closePane(page);

	// A player's feedback came back with the game; then the game ends.
	await page.evaluate(
		(key) =>
			localStorage.setItem(
				key,
				JSON.stringify({
					version: 1,
					entries: [
						{
							id: 'one',
							name: 'Ana',
							feedback: { version: 1, rating: 4, accolades: ['pacing'], anonymous: false }
						}
					]
				})
			),
		`grim-games:game-feedback:${gameId}`
	);
	await paneButton(page, 'Session', 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();

	players = await openPlayers(page);
	await expect(players.getByRole('button', { name: /^Player feedback/ })).toHaveCount(0);
	const after = await openPane(page, 'Session');
	const feedback = after.getByRole('button', { name: /^Player feedback/ });
	await expect(feedback).toBeEnabled();
	await expect(after.getByTestId('feedback-average')).toHaveText('4 of 5 from 1 rated');
	await expect(after.getByTestId('feedback-entry')).toContainText('Ana');
});
