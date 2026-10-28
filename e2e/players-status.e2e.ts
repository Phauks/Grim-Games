import { expect, test } from '@playwright/test';
import { toBoard } from './new-game.ts';

// The Storyteller's day timer on players' phones (Trevor, 2026-10-26: "timer populates on
// other screens, as sun not timer (sun or timer for players)"; the Storyteller decides), in a
// status line for where the game is up to ("During Town Phase, it says Town, during night it
// says night ... and also reiterates which day it is").

test("players' phones show where the game is up to, with the day timer as a sun or the clock", async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');
	const status = phone.getByTestId('players-status');
	const shown = phone.getByTestId('players-timer');
	// Setup, and the count of phones in the room with no seat: this one.
	await expect(status).toHaveText(/^Setup\s*\+1$/);
	// Beside Setup, a candle for each seat by default (Trevor, 2026-10-28), lit once a phone sits
	// there; nobody sits yet, and this phone is in the room without a seat.
	const setupSky = phone.getByTestId('players-setup-sky');
	await expect(setupSky).toHaveAttribute('data-look', 'candles');
	const seatCount = await page.getByRole('button', { name: /^Seat \d+:/ }).count();
	await expect(setupSky.locator('.candle')).toHaveCount(seatCount);
	await expect(setupSky.locator('.candle[data-state="lit"]')).toHaveCount(0);
	await expect(setupSky).toHaveAttribute(
		'aria-label',
		`0 of ${seatCount} seats with a player here. 1 more in the room without a seat`
	);
	// The Storyteller can show the town at dusk instead, from the timer's own controls.
	await page.getByRole('button', { name: /^Day timer, .*; open its controls$/ }).tap();
	const timerSheet = page.getByTestId('timer-sheet');
	await timerSheet.getByRole('combobox', { name: 'Setup on players’ phones' }).tap();
	await page.getByRole('option', { name: 'Town at dusk', exact: true }).tap();
	await expect(setupSky).toHaveAttribute('data-look', 'town');
	await timerSheet.getByRole('combobox', { name: 'Setup on players’ phones' }).tap();
	await page.getByRole('option', { name: 'Candles for the seats', exact: true }).tap();
	await expect(setupSky).toHaveAttribute('data-look', 'candles');
	await page.keyboard.press('Escape');
	await expect(timerSheet).toBeHidden();
	// Alone on its row, across the whole of it (Trevor, 2026-10-27: "the game status bar should
	// then take up the entire horizontal of that line area").
	const across = (await phone.getByRole('tablist').boundingBox())!.width;
	expect((await status.boundingBox())!.width).toBeGreaterThan(across * 0.95);

	// One character, so the bank offers Start game; the first night shows no timer.
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
	await expect(status).toHaveText('Night 1');
	const night = (await status.boundingBox())!;
	const nightWidth = night.width;
	await expect(shown).toHaveCount(0);
	// The night fills the sun's space with its own sky, a moon and stars (Trevor, 2026-10-28:
	// "at night, we should show some moons and stars, not just blank space").
	await expect(phone.getByTestId('players-night-sky')).toBeVisible();
	await expect(setupSky).toHaveCount(0);

	// The day: a sun by default, rising on the left while the day's time is all to come.
	await bank.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day).toBeVisible();
	await expect(status).toContainText('Day 1');
	await expect(shown).toHaveAttribute('data-look', 'sun');
	await expect(shown.getByRole('img')).toHaveAttribute(
		'aria-label',
		'Day timer: 100% of the day left'
	);
	await expect(phone.getByTestId('players-night-sky')).toHaveCount(0);
	// The same box as at night, so neither the row nor anything below it moves as the phase
	// changes.
	const sun = (await status.boundingBox())!;
	expect(Math.abs(sun.width - nightWidth)).toBeLessThanOrEqual(1);
	expect(Math.abs(sun.y - night.y)).toBeLessThanOrEqual(1);
	expect(Math.abs(sun.height - night.height)).toBeLessThanOrEqual(1);
	// The sun's sky spans most of the row (Trevor, 2026-10-27: "a sun that takes up 80% of the
	// width"), drawn as a slice of a circle.
	const sky = (await shown.getByRole('img').boundingBox())!;
	expect(sky.width).toBeGreaterThan(sun.width * 0.6);

	// A tap opens the day's counts, the Storyteller's own numbers (Trevor, 2026-10-27).
	await status.tap();
	const counts = phone.getByRole('dialog', { name: 'Day 1' });
	await expect(counts.getByTestId('players-alive')).toHaveText(
		(await day.getByTestId('alive-count').textContent())!
	);
	await expect(counts.getByTestId('players-votes-needed')).toHaveText(
		(await day.getByTestId('votes-needed').textContent())!
	);
	await expect(counts.getByTestId('players-ghost-votes')).toHaveText(
		(await day.getByTestId('ghost-votes').textContent())!
	);
	await expect(counts).toContainText('8 of 8 players alive');
	await counts.getByRole('button', { name: 'Close' }).tap();
	await expect(counts).toBeHidden();

	// The Storyteller starts it, and the sun sets off across the sky. 4:00 for 8 players, so 1% is 2.4s.
	await day.getByRole('button', { name: 'Start timer' }).tap();
	await expect(shown.getByRole('img')).toHaveAttribute(
		'aria-label',
		/^Day timer: (9\d)% of the day left$/,
		{ timeout: 10_000 }
	);

	// The timer's own sheet on the board says how players see it: the clock itself.
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();
	await page.getByRole('button', { name: /^Day timer, .*; open its controls$/ }).tap();
	const controls = page.getByTestId('timer-sheet');
	await controls.getByRole('combobox', { name: 'Day timer on players’ phones' }).tap();
	await page.getByRole('option', { name: 'Timer', exact: true }).tap();
	await expect(shown).toHaveAttribute('data-look', 'timer');
	await expect(shown.getByRole('timer')).toHaveText(/^3:[0-5]\d$/);

	// Hidden keeps it to the Storyteller.
	await controls.getByRole('combobox', { name: 'Day timer on players’ phones' }).tap();
	await page.getByRole('option', { name: 'Hidden', exact: true }).tap();
	await expect(shown).toHaveCount(0);
	// The status line still says which day it is.
	await expect(status).toHaveText('Day 1');
	await page.keyboard.press('Escape');
	await expect(controls).toBeHidden();

	// Back to town, confirmed: the rest of the day is Town, still saying which day; the day
	// timer stops and the players' sun has set (Trevor, 2026-10-27).
	await page.getByRole('button', { name: /^Day timer, .*; open its controls$/ }).tap();
	await controls.getByRole('combobox', { name: 'Day timer on players’ phones' }).tap();
	await page.getByRole('option', { name: 'Sun', exact: true }).tap();
	await expect(shown).toHaveAttribute('data-look', 'sun');
	await page.keyboard.press('Escape');
	await expect(controls).toBeHidden();
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await menu.getByRole('button', { name: 'Back to town' }).tap();
	await expect(menu).toBeHidden();
	const confirm = page.getByRole('alertdialog', { name: 'Back to town?' });
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Start timer' }).first()).toBeVisible();
	await expect(status).toHaveAttribute('data-phase', 'town');
	await expect(shown.getByRole('img')).toHaveAttribute(
		'aria-label',
		'Day timer: 0% of the day left'
	);
	await expect(status).toContainText('Town');
	await expect(status).toContainText('Day 1');
	await phoneContext.close();
});
