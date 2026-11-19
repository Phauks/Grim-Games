import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { closePane } from './players.ts';
import { openSettingsDialog } from './shell.ts';
import { openBoardTheme } from './theme.ts';

/**
 * Moving backgrounds (M43, Trevor 2026-11-03: "let's implement this"): picked among the
 * background tiles in the game's Theme (Trevor, 2026-11-18: changes show on the real board),
 * customised in their own dialog with a preview, held still while animations are off
 * (Trevor, 2026-11-16).
 */

// A new game, then the Theme: longer than a test's usual 30 seconds.
test.describe.configure({ timeout: 90_000 });

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
}

async function openSection(page: Page, section: string) {
	const dialog = await openSettingsDialog(page);
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

test('a moving background is picked, customised and shown on the board', async ({ page }) => {
	await startGame(page);
	const dialog = await openBoardTheme(page, 'Background');
	const preview = page.getByTestId('board-background');
	const customise = dialog.getByRole('button', { name: /^Customise/ });
	const thirty = dialog.getByRole('checkbox', {
		name: 'Animated background at 30 frames a second'
	});
	// Held in place until a moving background is chosen, so nothing moves when one is.
	await expect(customise).toBeDisabled();
	await expect(thirty).toBeDisabled();

	await dialog.getByRole('button', { name: 'Rain' }).tap();
	await expect(preview).toHaveAttribute('data-moving', 'rain');
	await expect(customise).toHaveAccessibleName('Customise Rain');
	await expect(thirty).toBeEnabled();

	await customise.tap();
	const editor = page.getByRole('dialog', { name: 'Customise Rain' });
	await expect(
		editor.getByTestId('background-preview').getByTestId('preview-background')
	).toHaveAttribute('data-moving', 'rain');
	const lightning = editor.getByRole('slider', { name: 'Lightning a minute' });
	await lightning.fill('0');
	await expect(lightning).toHaveAttribute('aria-valuetext', 'None');
	// A setting of the Storyteller's own is no longer a preset.
	await expect(editor.getByRole('combobox', { name: 'Preset' })).toHaveText(/Your own/);
	await editor.getByRole('button', { name: 'Confirm' }).tap();
	await expect(editor).toBeHidden();

	// Kept: opening it again shows the change.
	await customise.tap();
	await expect(editor.getByRole('slider', { name: 'Lightning a minute' })).toHaveValue('0');
	await editor.getByRole('button', { name: 'Cancel' }).tap();
	await expect(editor).toBeHidden();
});

test('a still background is customised: Stone made into slate (M72)', async ({ page }) => {
	await startGame(page);
	const dialog = await openBoardTheme(page, 'Background');
	const preview = page.getByTestId('board-background');
	// Still and Animated are labelled groups (Trevor, 2026-11-06: option A).
	const still = dialog.getByRole('group', { name: 'Still', exact: true });
	await expect(dialog.getByRole('group', { name: 'Animated', exact: true })).toBeVisible();
	await still.getByRole('button', { name: 'Stone' }).tap();
	await expect(preview).toHaveAttribute('data-preset', 'stone');
	const before = await preview.evaluate((el) => getComputedStyle(el).backgroundColor);

	const customise = dialog.getByRole('button', { name: 'Customise Stone' });
	await customise.tap();
	const editor = page.getByRole('dialog', { name: 'Customise Stone' });
	await expect(
		editor.getByTestId('background-preview').getByTestId('preview-background')
	).toHaveAttribute('data-preset', 'stone');
	await editor.getByRole('combobox', { name: 'Preset' }).tap();
	await page.getByRole('option', { name: 'Slate' }).tap();
	await editor.getByRole('button', { name: 'Confirm' }).tap();
	await expect(editor).toBeHidden();
	await expect
		.poll(() => preview.evaluate((el) => getComputedStyle(el).backgroundColor))
		.not.toBe(before);

	// Kept: opening it again shows the preset.
	await customise.tap();
	await expect(editor.getByRole('combobox', { name: 'Preset' })).toHaveText(/Slate/);
	await editor.getByRole('button', { name: 'Cancel' }).tap();
});

test('a moving background holds still while animations are off', async ({ page }) => {
	// Off by the device's Reduce motion (Match device), then by the app's own Animations
	// setting (Trevor, 2026-11-16: one switch for every role).
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await startGame(page);
	let dialog = await openBoardTheme(page, 'Background');
	const preview = page.getByTestId('board-background');
	const thirty = dialog.getByRole('checkbox', {
		name: 'Animated background at 30 frames a second'
	});
	await dialog.getByRole('button', { name: 'Stars' }).tap();
	await expect(preview).toHaveAttribute('data-still', '');
	await expect(thirty).toBeDisabled();

	// Animations On moves it whatever the device says.
	await closePane(page);
	const settings = await openSection(page, 'Theme');
	await settings.getByRole('combobox', { name: 'Animations' }).tap();
	await page.getByRole('option', { name: 'On', exact: true }).tap();
	await page.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
	dialog = await openBoardTheme(page, 'Background');
	await expect(thirty).toBeEnabled();
	await expect(dialog.getByText('Hold animated backgrounds still', { exact: true })).toHaveCount(0);
	// A phone's pane is a sheet over the board, which pauses it while open.
	await closePane(page);
	await expect(preview).not.toHaveAttribute('data-still', '');
});
