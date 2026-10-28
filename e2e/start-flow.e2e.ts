import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// One start flow for every game (Trevor, 2026-10-23): New game, the special rules when any
// are on, then Character selection, each with a Back to the step before that keeps what was
// chosen.

const setupBar = (page: Page) => page.getByRole('navigation', { name: 'Setup' });

test('a plain game starts on Character selection, and Back returns to New game as it was', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await page.getByRole('button', { name: 'More players' }).tap();

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

test('a game with a special rule restates it, then Character selection; Back keeps the rule', async ({
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
	await page.getByRole('button', { name: 'Create game' }).tap();
	const recap = page.getByRole('dialog', { name: 'Special rules in this game' });
	await recap.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);

	await setupBar(page).getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
	await expect(page.getByRole('main').getByRole('button', { name: /^Special rules/ })).toHaveText(
		'Special rules 1'
	);
});

test('Character selection goes on to the board without a bag', async ({ page }) => {
	await page.goto('/new');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await page.getByTestId('setup-to-board').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
});
