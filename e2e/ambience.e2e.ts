import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Day and night sound (plan U3, Trevor 2026-10-26: "Ambient sound during the day or night",
// one recording at a time, Trevor's pick of the same day): off until turned on, and only once
// the first night begins does the board fetch and play the night's recording.

test('day and night sound plays recordings on the board once the night begins', async ({
	page
}) => {
	const fetched: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/ambience/')) fetched.push(path);
	});
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	// From the board's ⋯ > Settings, which opens all of Settings (Trevor, 2026-10-27).
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	// Phones show one section at a time: back to the list first.
	const back = settings.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	await expect(settings.getByRole('heading', { name: 'Day and night sound' })).toBeVisible();
	const on = settings.getByRole('checkbox', { name: 'Play on the board' });
	await expect(on).not.toBeChecked();
	// Every row is in place while it is off, disabled.
	await expect(settings.getByRole('slider', { name: 'Level' })).toBeDisabled();
	const night = settings.getByRole('combobox', { name: 'Night sound' });
	await expect(night).toContainText('Evening meadow');
	await expect(night).toBeDisabled();
	await expect(settings.getByRole('combobox', { name: 'Day sound' })).toBeDisabled();

	await settings.getByText('Play on the board', { exact: true }).tap();
	await expect(on).toBeChecked();
	await expect(night).toBeEnabled();
	await expect(settings.getByRole('slider', { name: 'Level' })).toBeEnabled();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();
	// Nothing plays in Setup, so nothing is fetched yet.
	expect(fetched).toEqual([]);

	// One character, so the bank offers Start game.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// The night's recording starts at once, the Evening meadow by default, and it is the only
	// one playing.
	await expect.poll(() => fetched).toContain('/sounds/ambience/night-meadow.mp3');
	expect(fetched.filter((path) => path.startsWith('/sounds/ambience/night-'))).toEqual([
		'/sounds/ambience/night-meadow.mp3'
	]);
});
