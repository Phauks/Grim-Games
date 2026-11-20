import { walkThrough } from './night-step.ts';
import { expect, test } from '@playwright/test';
import { openSoundSettings, playSound } from './board-menu.ts';
import { pickScript, toBoard } from './new-game.ts';
import { closePane } from './players.ts';

// The game's sounds (Trevor, 2026-11-19: "lets identify the full sound flow and what it should
// do"): each moment of a game plays its own sound, on by default and set in Settings > Sound,
// and the pane's More, Sounds plays one sound now (option D: "i don't think we need all these
// sounds in this manner").

test('the pane plays one picked sound, and Start game plays the Dusk sound', async ({ page }) => {
	const fetched: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/board/')) fetched.push(path);
	});
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);

	// Not beside the day timer, which has Back to town.
	await expect(
		page.locator('.toolbar-timer').getByRole('button', { name: 'Soundboard' })
	).toHaveCount(0);
	// Nothing is fetched until a sound is played.
	expect(fetched).toEqual([]);
	const sounds = await playSound(page, 'Heartbeat');
	await expect.poll(() => fetched).toContain('/sounds/board/heartbeat.mp3');
	// Playing, Play becomes Stop; a heartbeat loops until stopped.
	const stop = sounds.getByRole('button', { name: 'Stop', exact: true });
	await expect(stop).toBeVisible();
	await page.waitForTimeout(1500);
	await expect(stop).toBeVisible();
	// Pause holds it (Trevor, 2026-10-27), and Resume carries on.
	await sounds.getByRole('button', { name: 'Pause', exact: true }).tap();
	await expect(sounds.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
	await sounds.getByRole('button', { name: 'Resume', exact: true }).tap();
	await stop.tap();
	await expect(sounds.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
	// Pause waits, disabled, until something plays.
	await expect(sounds.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
	// Day and night sound is beside it, to cut mid-game.
	const ambience = sounds.getByRole('checkbox', {
		name: 'Day and night sound',
		includeHidden: true
	});
	await expect(ambience).not.toBeChecked();
	// No mixer, mixes or list of sounds to edit any more.
	await expect(sounds.getByRole('slider')).toHaveCount(0);
	await expect(sounds.getByRole('button', { name: 'Edit soundboard' })).toHaveCount(0);
	expect(errors).toEqual([]);
	await closePane(page);

	// Every moment has its sound in Settings > Sound, on by default.
	const settings = await openSoundSettings(page);
	await expect(settings.getByRole('combobox', { name: 'Dusk' })).toContainText('Temple bell');
	await expect(settings.getByRole('combobox', { name: 'Dusk' })).toBeEnabled();
	for (const moment of ['Dawn', 'Execution', 'Timer sound', 'Back to town', 'Game end'])
		await expect(settings.getByRole('combobox', { name: moment })).toBeVisible();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	// One character, so the bank offers Start game.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const seatSheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await seatSheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seatSheet).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(walkThrough(page).or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// The first night begins: Dusk's sound plays.
	await expect.poll(() => fetched).toContain('/sounds/board/temple-bell.mp3');
});
