import { expect, test } from '@playwright/test';
import { toBoard } from './new-game.ts';

// The Storyteller's player view shows what phones show (Trevor, 2026-10-27: "storyteller view
// of player view is incorrect and does not include everything. Design it so that these
// additions move in automatically! (Ie, stage tracker and timer)"), with or without a room.

test("the Storyteller's player view has the players' status row and day timer", async ({
	page
}) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	const script = page.getByRole('dialog', { name: 'Trouble Brewing' });
	const status = script.getByTestId('players-status');
	// Setup, over the tabs as on /play.
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	await expect(status).toHaveText('Setup');
	const statusBox = (await status.boundingBox())!;
	const tabsBox = (await script.getByRole('tablist').boundingBox())!;
	expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(tabsBox.y + 1);
	// On a wide, short window the whole town fits under the tabs, with no scrolling to reach
	// its bottom seats (Trevor, 2026-10-27: cut off on a desktop window).
	const device = page.viewportSize()!;
	await page.setViewportSize({ width: 1600, height: 820 });
	await script.getByRole('tab', { name: 'Grim' }).tap();
	await expect(async () => {
		const town = (await script.getByTestId('player-grim').boundingBox())!;
		const scroll = (await script.getByTestId('script-scroll').boundingBox())!;
		expect(town.y + town.height).toBeLessThanOrEqual(scroll.y + scroll.height + 1);
	}).toPass();
	await script.getByRole('tab', { name: 'Script' }).tap();
	await page.setViewportSize(device);
	await page.keyboard.press('Escape');
	await expect(script).toBeHidden();

	// One character, so the bank offers Start game.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const seat = page.locator('[data-scope="drawer"][data-part="content"]');
	await seat.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seat).toBeHidden();
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	await bank.getByRole('button', { name: 'Start game', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(strip).toBeVisible();

	// The day, with the players' sun.
	await bank.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day).toBeVisible();
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();

	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	await expect(status).toContainText('Day 1');
	await expect(script.getByTestId('players-timer')).toHaveAttribute('data-look', 'sun');
	// No Traveller yet, so the day's counts say nothing about exiles.
	await status.tap();
	const counts = page.getByTestId('players-counts');
	await expect(counts.getByTestId('players-votes-needed')).toBeVisible();
	await expect(counts.getByTestId('players-exile-needed')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(counts).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(script).toBeHidden();

	// A Traveller sits down: the counts add the players needed to exile one (Trevor,
	// 2026-10-28), half of all 8 players, alive or dead (wiki Glossary, "Exile" and "Player").
	await page.getByRole('button', { name: /^Seat 2:/ }).tap();
	await seat.getByRole('button', { name: 'Choose character' }).first().tap();
	const pick = page.getByRole('dialog', { name: 'Character for Seat 2' });
	await pick.getByRole('searchbox').fill('Scapegoat');
	await pick.getByRole('button', { name: /^Scapegoat/ }).tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seat).toBeHidden();
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	await status.tap();
	await expect(counts.getByTestId('players-exile-needed')).toHaveText('4');
	await expect(counts).toContainText('4 players must support an exile (8 players, alive or dead)');
	await page.keyboard.press('Escape');
	await expect(counts).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(script).toBeHidden();

	// The grim cover's Player view is the same view.
	await page.getByTestId('cover-button').tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await cover.getByRole('button', { name: 'Player view' }).tap();
	const view = page.getByTestId('cover-player-view');
	await expect(view.getByTestId('players-status')).toContainText('Day 1');
	await expect(view.getByTestId('players-timer')).toHaveAttribute('data-look', 'sun');
});
