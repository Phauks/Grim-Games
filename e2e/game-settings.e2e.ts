import { expect, test, type Page } from '@playwright/test';
import { pickScript, pastGameSettings } from './new-game.ts';

// Game settings (Trevor, 2026-10-28): a start-flow step of its own, after Special rules, for
// the settings kept per game. Each game keeps its own; Settings holds the default for new games.

const marks = (page: Page) => page.getByTestId('seat').first().getByTestId('nomination-marks');

async function startToGameSettings(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/game-settings$/);
	return page.getByTestId('game-settings');
}

async function onToBoard(page: Page) {
	await pastGameSettings(page);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await page.getByTestId('setup-to-board').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
}

test('Game settings is its own start step, and a choice there is kept for that game only', async ({
	page
}) => {
	const settings = await startToGameSettings(page);
	const track = settings.getByRole('checkbox', { name: 'Track nominations', includeHidden: true });
	await expect(track).not.toBeChecked();
	// The day timer is always on players' phones: only its style is a choice (Trevor, 2026-10-28).
	await settings.getByRole('combobox', { name: 'Day timer on players’ phones' }).tap();
	await expect(page.getByRole('option')).toHaveText(['Sun', 'Timer']);
	await page.keyboard.press('Escape');
	await settings.getByText('Track nominations', { exact: true }).tap();
	await expect(track).toBeChecked();
	await onToBoard(page);
	await expect(marks(page)).toBeVisible();

	// The board's ⋯ › Game opens the same settings, for this game.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Game settings' })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Game settings' });
	await expect(
		dialog.getByRole('checkbox', { name: 'Track nominations', includeHidden: true })
	).toBeChecked();
	await dialog.getByText('Track nominations', { exact: true }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(marks(page)).toHaveCount(0);

	// The next game starts from Settings' default, untouched by the first game's choice.
	const next = await startToGameSettings(page);
	await expect(
		next.getByRole('checkbox', { name: 'Track nominations', includeHidden: true })
	).not.toBeChecked();
});

test('Back from Game settings returns to New game, and Character selection comes back to it', async ({
	page
}) => {
	await startToGameSettings(page);
	await pastGameSettings(page);
	const bar = page.getByRole('navigation', { name: 'Setup', exact: true });
	await bar.getByRole('button', { name: 'Game settings' }).tap();
	await expect(page).toHaveURL(/\/game-settings$/);
	await bar.getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
});
