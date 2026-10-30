import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// Game settings (Trevor, 2026-10-28), the settings kept per game: each game keeps its own;
// Settings holds the default for new games. Since 2026-10-29 it is no longer a start-flow step:
// it opens over Character selection, with the settings profile the game starts with.

const marks = (page: Page) => page.getByTestId('seat').first().getByTestId('nomination-marks');

async function startToGameSettings(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await page.getByTestId('game-options').getByRole('button', { name: 'Game settings' }).tap();
	return page.getByRole('dialog', { name: 'Game settings' }).getByTestId('game-settings');
}

async function onToBoard(page: Page) {
	await page
		.getByRole('dialog', { name: 'Game settings' })
		.getByRole('button', { name: 'Close' })
		.tap();
	await page.getByTestId('setup-to-board').tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
}

test('Game settings opens on Character selection, and a choice there is kept for that game only', async ({
	page
}) => {
	const settings = await startToGameSettings(page);
	// The profile the game starts with comes first, until the game begins.
	await expect(settings.getByRole('combobox', { name: 'Settings profile' })).toHaveText(
		/My settings/
	);
	const track = settings.getByRole('checkbox', { name: 'Track nominations', includeHidden: true });
	await expect(track).not.toBeChecked();
	// Players' phones always show the day timer as a sun (Trevor, 2026-10-29): no choice of it.
	await expect(
		settings.getByRole('combobox', { name: 'Day timer on players’ phones' })
	).toHaveCount(0);
	await settings.getByText('Track nominations', { exact: true }).tap();
	await expect(track).toBeChecked();
	// What phones show beside Setup is chosen here too (Trevor, 2026-10-28).
	const look = settings.getByRole('combobox', { name: 'Setup on players’ phones' });
	await look.tap();
	await page.getByRole('option', { name: 'Town at dusk', exact: true }).tap();
	await expect(look).toHaveText(/Town at dusk/);
	await onToBoard(page);
	await expect(marks(page)).toBeVisible();

	// The board's ⋯ › Game opens the same settings, for this game.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Game settings' })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Game settings' });
	await expect(dialog.getByRole('combobox', { name: 'Settings profile' })).toHaveCount(0);
	await expect(
		dialog.getByRole('checkbox', { name: 'Track nominations', includeHidden: true })
	).toBeChecked();
	await expect(dialog.getByRole('combobox', { name: 'Setup on players’ phones' })).toHaveText(
		/Town at dusk/
	);
	await dialog.getByText('Track nominations', { exact: true }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(marks(page)).toHaveCount(0);

	// The next game starts from Settings' default, untouched by the first game's choice.
	const next = await startToGameSettings(page);
	await expect(
		next.getByRole('checkbox', { name: 'Track nominations', includeHidden: true })
	).not.toBeChecked();
});

test('Game settings is no step: Character selection goes back to New game', async ({ page }) => {
	await startToGameSettings(page);
	await page
		.getByRole('dialog', { name: 'Game settings' })
		.getByRole('button', { name: 'Close' })
		.tap();
	const bar = page.getByRole('navigation', { name: 'Setup', exact: true });
	await expect(bar.getByRole('button', { name: 'Game settings' })).toHaveCount(0);
	await bar.getByRole('button', { name: 'New game' }).tap();
	await expect(page).toHaveURL(/\/new#back$/);
});

test('Game settings splits into Day and Bag draw tabs that keep the dialog one size', async ({
	page
}) => {
	// Trevor (2026-10-29): "game settings page should be tabbed, so it doesn't run down one screen".
	const settings = await startToGameSettings(page);
	const tabs = settings.getByRole('tab');
	await expect(tabs).toHaveText(['Day', 'Bag draw']);
	await expect(settings.getByText('Track nominations', { exact: true })).toBeVisible();
	await expect(settings.getByText('Slot machine reveal', { exact: true })).toBeHidden();
	const dialog = page.getByRole('dialog', { name: 'Game settings' });
	const before = (await dialog.boundingBox())!;

	await tabs.filter({ hasText: 'Bag draw' }).tap();
	await expect(settings.getByText('Slot machine reveal', { exact: true })).toBeVisible();
	await expect(settings.getByText('Track nominations', { exact: true })).toBeHidden();
	// A tab change never resizes the dialog (no reflow).
	const after = (await dialog.boundingBox())!;
	expect(Math.abs(after.height - before.height)).toBeLessThan(1);
	expect(Math.abs(after.y - before.y)).toBeLessThan(1);
	const slot = settings.getByRole('checkbox', { name: 'Slot machine reveal', includeHidden: true });
	await settings.getByText('Slot machine reveal', { exact: true }).tap();
	await expect(slot).toBeChecked();
});
