import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// How long the game has run, under the join code in the board's corner (Trevor, 2026-10-23:
// "starts when first night begins"). Kept on the device, so a reload keeps it.

test('the board shows how long the game has run since the first night began', async ({ page }) => {
	await page.clock.install();
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	const clock = page.getByTestId('board-game-clock');
	// In place before the first night, so nothing moves when it starts: Game time says 0:00,
	// and Game phase's own line says Setup (Trevor, 2026-10-26).
	await expect(clock).toHaveText(/^\s*Game time:?\s*0:00\s*$/);
	const phase = page.getByTestId('board-phase');
	await expect(phase).toHaveText('Setup');
	const corner = page.getByTestId('script-title');
	const height = (await corner.boundingBox())?.height;

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
	const start = page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true });
	await start.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	await expect(clock).toHaveText(/Game time:?\s*0:00/);
	await expect(phase).toHaveText('Night 1');
	await page.clock.runFor(65_000);
	await expect(clock).toHaveText(/Game time:?\s*1:05/);
	// The corner never grows (the night's strip may move the whole board). Where the smaller
	// board leaves no room for a line of its own, Game time shares the join code's line.
	expect((await corner.boundingBox())!.height).toBeLessThanOrEqual(height!);

	// A reload keeps the start: the clock carries on from it.
	await page.reload();
	await page.clock.runFor(10_000);
	await expect(page.getByTestId('board-game-clock')).toHaveText(/Game time:?\s*1:1\d/);
});
