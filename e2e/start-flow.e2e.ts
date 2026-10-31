import { expect, test, type Page } from '@playwright/test';
import { chooseRulesOnSetup, pickScript } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// One start flow for every game (Trevor, 2026-10-23): New game, then Character selection, where
// the special rules and Game settings open (Trevor, 2026-10-29), with a Back to New game that
// keeps what was chosen.

const setupBar = (page: Page) => page.getByRole('navigation', { name: 'Setup' });

test('a plain game goes to Character selection, and Back returns to New game as it was', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 9);

	await setupBar(page).getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
	await expect(
		page.getByRole('radiogroup', { name: 'Script' }).getByRole('radio', { name: 'Bad Moon Rising' })
	).toBeChecked();
	// The count chosen on Character selection comes back with the next game (Trevor, 2026-10-28).
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page.getByTestId('player-count')).toHaveText('9');
	await setupBar(page).getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
	// The game Start made was dropped, so starting again leaves one game, not two.
	await page.goto('/join');
	await expect(page.getByText('Bad Moon Rising')).toHaveCount(0);
});

test('special rules are chosen on Character selection, and Back and Create game keep them', async ({
	page
}) => {
	// Trevor, 2026-10-29: special rules on the Character selection screen, not a step of their own.
	await page.goto('/new');
	await expect(page.getByRole('main').getByRole('button', { name: /^Special rules/ })).toHaveCount(
		0
	);
	await page.getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'Stowed Away');
	// The rules in the game come first, restated with their own switches.
	await page.getByTestId('setup-special-rules').tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await expect(rules.getByTestId('rules-in-game')).toContainText('Stowed Away');
	await rules.getByRole('button', { name: 'Close' }).tap();
	await expect(rules).toBeHidden();

	await setupBar(page).getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await expect(page.getByTestId('setup-special-rules')).toHaveText('Special rules 1');
});

test('Character selection goes on to the board without a bag', async ({ page }) => {
	await page.goto('/new');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await page.getByTestId('setup-to-board').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
});
