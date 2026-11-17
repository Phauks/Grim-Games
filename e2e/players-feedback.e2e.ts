import { expect, test } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { closePane, openPlayers } from './players.ts';

// Players is one column of pill sections (Trevor, 2026-11-17, "A"): Players with Show's eye on
// its pill, the player tapped, Spectators, then Player feedback, kept in place but closed until
// the game is over (Trevor, 2026-11-16: "not available until after the game. keeps review
// separate from the game").

test('Player feedback sits under Spectators and opens once the game is over', async ({ page }) => {
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
	const names = [/^Players/, /^Seat 1$/, /^Spectators/, /^Player feedback/];
	await expect(sections).toHaveCount(names.length);
	for (const [n, name] of names.entries())
		await expect(sections.nth(n).getByRole('button').first()).toHaveAccessibleName(name);
	// Show characters is an eye on the Players pill, with no word on it.
	const show = players.getByTestId('roles-show');
	await expect(show).toHaveAccessibleName('Show characters');
	await expect(show).toHaveText('');
	const feedback = players.getByRole('button', { name: /^Player feedback/ });
	await expect(feedback).toBeDisabled();
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
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();

	players = await openPlayers(page);
	await expect(feedback).toBeEnabled();
	await expect(players.getByTestId('feedback-average')).toHaveText('4 of 5 from 1 rated');
	await expect(players.getByTestId('feedback-entry')).toContainText('Ana');
});
