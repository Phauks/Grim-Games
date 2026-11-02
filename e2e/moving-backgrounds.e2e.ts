import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Moving backgrounds (L113): twelve built-in scenes that move behind the board, drawn in CSS
// or by a WebGL shader, each with a still frame for the swatch and for the Moving
// backgrounds switch turned off.

async function boardSettings(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board', exact: true })
		.tap();
	await expect(settings.getByRole('heading', { name: 'Board', level: 2 })).toBeVisible();
	return settings;
}

test('a moving background moves behind the board, and stays still when switched off', async ({
	page
}) => {
	const settings = await boardSettings(page);
	const choices = settings.getByRole('group', { name: 'Background', exact: true });
	const moving = settings.getByRole('checkbox', { name: 'Moving backgrounds' });
	// Nothing to move on a plain board, so the switch waits, on.
	await expect(moving).toBeDisabled();
	await expect(moving).toBeChecked();
	// The swatches are still frames, not twelve scenes moving at once.
	await expect(choices.getByTestId('board-scene')).toHaveCount(0);
	await expect(choices.locator('canvas')).toHaveCount(0);

	// A shader scene, behind the board and in the preview.
	await choices.getByRole('button', { name: 'Hellfire' }).tap();
	const scene = page.getByTestId('board-scene');
	await expect(scene).toHaveAttribute('data-scene', 'hellfire');
	await expect(scene).toHaveAttribute('data-engine', 'shader');
	await expect(scene).toHaveAttribute('data-still', 'false');
	await expect(scene.locator('canvas')).toBeAttached();
	// Its still frame under it, as for any preset.
	await expect(page.getByTestId('board-background')).toHaveAttribute('data-preset', 'hellfire');
	await expect(settings.getByTestId('preview-scene')).toHaveAttribute('data-scene', 'hellfire');
	await expect(moving).toBeEnabled();

	// A CSS scene.
	await choices.getByRole('button', { name: 'Tropical beach' }).tap();
	await expect(scene).toHaveAttribute('data-scene', 'beach');
	await expect(scene).toHaveAttribute('data-engine', 'css');
	await expect(scene.locator('canvas')).toHaveCount(0);
	const sun = settings.getByTestId('preview-scene').locator('.sun');
	await expect(sun).toHaveCSS('animation-play-state', 'running');

	// Off: every scene shows its still frame, on the board and in the preview.
	await moving.dispatchEvent('click');
	await expect(moving).not.toBeChecked();
	await expect(scene).toHaveAttribute('data-still', 'true');
	await expect(settings.getByTestId('preview-scene')).toHaveAttribute('data-still', 'true');
	await expect(sun).toHaveCSS('animation-play-state', 'paused');

	// Kept, with the background, after a reload.
	await page.reload();
	await expect(page.getByTestId('board-scene')).toHaveAttribute('data-scene', 'beach');
	await expect(page.getByTestId('board-scene')).toHaveAttribute('data-still', 'true');
});
