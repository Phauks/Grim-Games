import { expect, test, type Page } from '@playwright/test';
import { pickScript, pastGameSettings } from './new-game.ts';

// One start flow for every game (Trevor, 2026-10-23): New game, the special rules when any
// are on, Game settings (Trevor, 2026-10-28), then Character selection, each with a Back to the
// step before that keeps what was chosen.

const setupBar = (page: Page) => page.getByRole('navigation', { name: 'Setup' });

test('a plain game goes through Game settings to Character selection, and Back returns to New game as it was', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'More players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await pastGameSettings(page);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);

	await setupBar(page).getByRole('link', { name: 'Game settings' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/game-settings$/);
	await setupBar(page).getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
	await expect(
		page.getByRole('radiogroup', { name: 'Script' }).getByRole('radio', { name: 'Bad Moon Rising' })
	).toBeChecked();
	await expect(page.getByTestId('player-count').first()).toHaveText('9');
	// The game Start made was dropped, so starting again leaves one game, not two.
	await page.goto('/join');
	await expect(page.getByText('Bad Moon Rising')).toHaveCount(0);
});

test('a game with a special rule restates it, then Game settings; Back keeps the rule', async ({
	page
}) => {
	await page.goto('/new');
	await page
		.getByRole('main')
		.getByRole('button', { name: /^Special rules/ })
		.tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await rules.getByTestId('special-rules').getByText('Stowed Away', { exact: true }).tap();
	await rules.getByRole('button', { name: 'Close' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	const recap = page.getByRole('dialog', { name: 'Special rules in this game' });
	await recap.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/game-settings$/);

	await setupBar(page).getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
	await expect(page.getByRole('main').getByRole('button', { name: /^Special rules/ })).toHaveText(
		'Special rules 1'
	);
});

test('Character selection goes on to the board without a bag', async ({ page }) => {
	await page.goto('/new');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await pastGameSettings(page);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await page.getByTestId('setup-to-board').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
});
