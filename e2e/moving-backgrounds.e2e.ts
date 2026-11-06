import { expect, test, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

/**
 * Moving backgrounds (M43, Trevor 2026-11-03: "let's implement this"): picked among the
 * background tiles, customised in their own dialog with a preview, held still by Reduce
 * motion or the Player switch (Trevor, 2026-11-05: "Storyteller's, with a still switch").
 */

async function openSection(page: Page, section: string) {
	const dialog = await openSettingsDialog(page);
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

test('a moving background is picked, customised and shown in the preview', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSection(page, 'Board');
	const preview = dialog.getByTestId('board-preview').getByTestId('preview-background');
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
	await page.goto('/');
	const dialog = await openSection(page, 'Board');
	const preview = dialog.getByTestId('board-preview').getByTestId('preview-background');
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

test('a moving background holds still with Reduce motion or the Player switch', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	let dialog = await openSection(page, 'Board');
	const preview = dialog.getByTestId('board-preview').getByTestId('preview-background');
	await dialog.getByRole('button', { name: 'Stars' }).tap();
	await expect(preview).toHaveAttribute('data-still', '');
	// Told to ignore Reduce motion, it moves.
	await dialog.getByRole('combobox', { name: 'Animated background with Reduce motion' }).tap();
	await page.getByRole('option', { name: 'Move as usual' }).tap();
	await expect(preview).not.toHaveAttribute('data-still', '');

	// Each phone's own switch holds it still whatever Reduce motion says.
	await page.getByRole('button', { name: 'Close' }).first().tap();
	dialog = await openSection(page, 'Player');
	await dialog.getByText('Hold animated backgrounds still', { exact: true }).tap();
	await page.getByRole('button', { name: 'Close' }).first().tap();
	dialog = await openSection(page, 'Board');
	await expect(
		dialog.getByTestId('board-preview').getByTestId('preview-background')
	).toHaveAttribute('data-still', '');
});
