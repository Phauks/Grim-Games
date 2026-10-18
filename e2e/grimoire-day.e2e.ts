import { expect, test, type Page } from '@playwright/test';

// The day sheet over the board of a saved game: executions, exiles and deaths, all
// by hand, each with a cause from the valid ones. Nominations happen off the grimoire.

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	return new URL(page.url()).pathname;
}

async function addThief(page: Page) {
	// A Traveller joins as a new seat: Add seat (the board asks where), then choose them.
	await page.getByRole('button', { name: 'More' }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add seat' })
		.tap();
	await page.getByRole('button', { name: 'Place between Seat 8 and Seat 1' }).tap();
	await page.getByRole('button', { name: /^Seat 9:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 9' })
		.getByRole('button', { name: 'Thief, Recommended', exact: true })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Evil' }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(
		page.locator('[data-testid="seat"][aria-label^="Seat 9: no name, Thief"]')
	).toBeAttached();
}

const seat = (page: Page, name: string) => page.getByRole('button', { name: `Seat: ${name}` });

test('the day screen marks an execution, survives a reload and shows votes needed', async ({
	page
}) => {
	const board = await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day' });
	await expect(day).toBeVisible();
	await expect(page).toHaveURL(board);
	// Before anything happens there is nothing to announce (Trevor).
	await expect(page.getByTestId('announcements')).toHaveText('None');
	// Living players and each team's, beside the votes (Trevor, 2026-10-17).
	// Living of all players, as 8/8 (Trevor, 2026-10-17).
	await expect(page.getByTestId('alive-count')).toHaveText('8/8');
	// No characters yet, so no team has anyone.
	await expect(page.getByTestId('alive-good')).toHaveAccessibleName('0 good alive');
	await expect(page.getByTestId('alive-evil')).toHaveText('0');
	// Ghost votes still to use sit beside the living (Trevor, 2026-10-17).
	await expect(page.getByTestId('ghost-votes')).toHaveText('0');
	// Nothing at the sides is cut off by a box that clips its overflow (Trevor, 2026-10-18).
	for (const id of ['alive-count', 'votes-needed']) {
		const clipped = await page.getByTestId(id).evaluate((el) => {
			const box = el.getBoundingClientRect();
			for (let up = el.parentElement; up; up = up.parentElement) {
				if (getComputedStyle(up).overflowX === 'visible') continue;
				const clip = up.getBoundingClientRect();
				if (box.left < clip.left - 0.5 || box.right > clip.right + 0.5) return true;
			}
			return false;
		});
		expect(clipped, id).toBe(false);
	}
	// All five counts on one line (Trevor, 2026-10-17).
	const tops = await page
		.getByTestId('day-toolbar')
		.locator('[role="note"]')
		.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
	expect(tops).toHaveLength(5);
	expect(new Set(tops).size).toBe(1);
	// The living show no ghost vote mark.
	await expect(seat(page, 'Seat 2').getByTestId('ghost-mark')).toBeHidden();
	// Every section folds away with its caret.
	const players = day.getByRole('button', { name: 'Players' });
	await players.tap();
	await expect(seat(page, 'Seat 1')).toBeHidden();
	await players.tap();
	await expect(seat(page, 'Seat 1')).toBeVisible();

	// A section's header stays just under the toolbar while its content scrolls (Trevor).
	await seat(page, 'Seat 8').evaluate((el) => el.scrollIntoView({ block: 'start' }));
	await expect(players).toBeInViewport();
	const toolbarBox = (await page.getByTestId('day-toolbar').boundingBox())!;
	expect((await players.boundingBox())!.y).toBeGreaterThanOrEqual(
		toolbarBox.y + toolbarBox.height - 1
	);

	// No nomination tracking, log, Undo or History here (Trevor, 2026-10-16).
	await expect(page.getByRole('radiogroup', { name: 'Tapping a player' })).toHaveCount(0);
	await expect(page.getByTestId('day-log')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0);

	// Tapping a player asks how they died; no Now/After line (Trevor, 2026-10-17).
	await seat(page, 'Seat 2').tap();
	const sheet = page.getByRole('dialog', { name: 'How did Seat 2 die?' });
	await expect(sheet).not.toContainText('Now:');
	await expect(sheet.getByRole('button', { name: 'Dead, no cause' })).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Executed' }).tap();
	await expect(sheet).toBeHidden();
	await expect(seat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');
	// Each player shows their character (none yet) and name; the death is listed to announce.
	await expect(seat(page, 'Seat 2')).toContainText('No character');
	// Death shows as the board does (dimmed icon, skull badge), never as dimmed text (Trevor).
	await expect(seat(page, 'Seat 2').getByTestId('dead-mark')).toBeVisible();
	await expect(seat(page, 'Seat 1').getByTestId('dead-mark')).toBeHidden();
	const colour = (name: string) =>
		seat(page, name)
			.locator('.seat-player')
			.evaluate((el) => getComputedStyle(el).color);
	expect(await colour('Seat 2')).toBe(await colour('Seat 1'));
	// A day death is not an announcement: those are the night's, for dawn (Trevor, 2026-10-18).
	await expect(page.getByTestId('announcements')).toHaveText('None');
	await expect(page.getByTestId('alive-count')).toHaveText('7/8');
	await expect(page.getByTestId('ghost-votes')).toHaveText('1');
	// A small mark while the ghost vote is unused; tapping the dead player offers it (Trevor).
	await expect(seat(page, 'Seat 2').getByTestId('ghost-mark')).toBeVisible();
	await seat(page, 'Seat 2').tap();
	const dead = page.getByRole('dialog', { name: 'Seat 2 is dead' });
	await dead.getByRole('button', { name: 'Mark ghost vote used' }).tap();
	await expect(dead).toBeHidden();
	await expect(page.getByTestId('ghost-votes')).toHaveText('0');
	await expect(seat(page, 'Seat 2').getByTestId('ghost-mark')).toBeHidden();
	await seat(page, 'Seat 2').tap();
	await dead.getByRole('button', { name: 'Give ghost vote back' }).tap();
	await expect(page.getByTestId('ghost-votes')).toHaveText('1');

	await page.reload();
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(seat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');
	// 7 of 8 alive: 4 votes put a player on the block.
	const votes = page.getByTestId('votes-needed');
	await expect(votes).toHaveText('4');
	await expect(votes).toHaveAttribute(
		'aria-label',
		'4 votes put the first nominee on the block (7 alive)'
	);

	// A dead player can be marked alive again.
	await seat(page, 'Seat 2').tap();
	const revive = page.getByRole('dialog', { name: 'Seat 2 is dead' });
	await expect(revive.getByRole('button', { name: 'Mark alive' })).toBeVisible();
	await expect(revive).not.toContainText('Now:');
	await revive.getByRole('button', { name: 'Cancel' }).tap();
	await expect(revive).toBeHidden();

	// Closing the sheet shows the board behind it, already updated.
	await page.getByRole('dialog', { name: 'Day' }).getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('dialog', { name: 'Day' })).toBeHidden();
	await expect(
		page.getByRole('button', { name: /^Seat 2: no name, no character, dead/ })
	).toBeAttached();
});

test('a Traveller is exiled, and a death offers only valid causes', async ({ page }) => {
	const board = await startGame(page);
	await addThief(page);
	// The old day link opens the day sheet over the board.
	await page.goto(`${board}/day`);
	await expect(page).toHaveURL(board);
	await expect(page.getByRole('dialog', { name: 'Day' })).toBeVisible();

	await seat(page, 'Seat 9').tap();
	const thief = page.getByRole('dialog', { name: 'How did Seat 9 die?' });
	await expect(thief.getByRole('button')).toHaveText(['Exiled', 'Killed by the Demon', 'Cancel']);
	await thief.getByRole('button', { name: 'Exiled' }).tap();
	await expect(seat(page, 'Seat 9')).toHaveAttribute('data-dead', 'true');

	// No characters are in play, so no character is offered; Cancel is set apart.
	await seat(page, 'Seat 3').tap();
	const causes = page.getByRole('dialog', { name: 'How did Seat 3 die?' });
	await expect(causes.getByRole('button')).toHaveText([
		'Executed',
		'Killed by the Demon',
		'Cancel'
	]);
	await causes.getByRole('button', { name: 'Killed by the Demon' }).tap();
	await expect(causes).toBeHidden();
	await expect(seat(page, 'Seat 3')).toHaveAttribute('data-dead', 'true');
	// 7 of 9 alive (the Thief exiled, Seat 3 dead): 4 votes.
	await expect(page.getByTestId('votes-needed')).toHaveAttribute('aria-label', /\(7 alive\)$/);
});

// Trevor, 2026-10-17: a day timer, usually 30 seconds per living player.
test('the day timer starts at 30 seconds per living player and signals time up', async ({
	page
}) => {
	await page.clock.install();
	await page.addInitScript(() => {
		(window as unknown as { vibrated: number }).vibrated = 0;
		navigator.vibrate = () => {
			(window as unknown as { vibrated: number }).vibrated++;
			return true;
		};
	});
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const timer = page.getByTestId('day-toolbar').getByTestId('day-timer');
	const clock = timer.getByRole('timer');
	// 8 players alive: 4 minutes.
	await expect(clock).toHaveText('4:00');
	await expect(timer.getByRole('button', { name: 'Reset timer' })).toBeDisabled();
	// A death before it starts follows the living players.
	await seat(page, 'Seat 2').tap();
	await page
		.getByRole('dialog', { name: 'How did Seat 2 die?' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await expect(clock).toHaveText('3:30');
	// Changed by hand, before or while it runs.
	await timer.getByRole('button', { name: '30 seconds less' }).tap();
	await expect(clock).toHaveText('3:00');
	const box = await timer.boundingBox();
	await timer.getByRole('button', { name: 'Start timer' }).tap();
	await page.clock.runFor(10_000);
	await expect(clock).toHaveText('2:50');
	// Ticking never moves anything.
	expect(await timer.boundingBox()).toEqual(box);
	await timer.getByRole('button', { name: 'Pause timer' }).tap();
	await page.clock.runFor(60_000);
	await expect(clock).toHaveText('2:50');
	await timer.getByRole('button', { name: '30 seconds more' }).tap();
	await expect(clock).toHaveText('3:20');
	await timer.getByRole('button', { name: 'Start timer' }).tap();
	await page.clock.runFor(201_000);
	await expect(clock).toHaveText('0:00');
	await expect(timer).toHaveAttribute('data-done', '');
	await expect(timer.getByRole('button', { name: 'Start timer' })).toBeDisabled();
	expect(await page.evaluate(() => (window as unknown as { vibrated: number }).vibrated)).toBe(1);
	// The finishing sound is the Storyteller's choice, kept as a setting.
	await timer.getByRole('button', { name: 'Timer sound: Bell' }).tap();
	const sounds = page.getByRole('dialog', { name: 'Timer sound' });
	await sounds.getByRole('combobox', { name: 'Timer sound' }).tap();
	await page.getByRole('option', { name: 'Chime', exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(timer.getByRole('button', { name: 'Timer sound: Chime' })).toBeVisible();
	// Reset: back to 30 seconds per living player (7 alive).
	await timer.getByRole('button', { name: 'Reset timer' }).tap();
	await expect(clock).toHaveText('3:30');
	await expect(timer).not.toHaveAttribute('data-done', '');
	// It stays in view while the day scrolls.
	await page.getByRole('button', { name: 'Seat: Seat 8' }).scrollIntoViewIfNeeded();
	await expect(timer).toBeInViewport();
	// Pinned right under the header: nothing scrolled shows above it (Trevor, 2026-10-17).
	const above = await page.getByTestId('day-toolbar').evaluate((toolbar) => {
		const box = toolbar.getBoundingClientRect();
		const el = document.elementFromPoint(box.left + box.width / 2, box.top - 1);
		return el?.closest('[data-testid="day-toolbar"]')
			? 'toolbar'
			: el?.closest('.panel')
				? 'content'
				: 'outside';
	});
	expect(above).toBe('outside');
	const scroller = page.getByTestId('day-toolbar').locator('xpath=../..');
	expect((await page.getByTestId('day-toolbar').boundingBox())!.y).toBeCloseTo(
		(await scroller.boundingBox())!.y,
		0
	);
	await page.reload();
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(
		page
			.getByTestId('day-toolbar')
			.getByTestId('day-timer')
			.getByRole('button', { name: 'Timer sound: Chime' })
	).toBeVisible();
});

// Trevor, 2026-10-17: the timer can count up instead, past its target.
test('the day timer counts up past its target when set to', async ({ page }) => {
	await page.clock.install();
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const timer = page.getByTestId('day-toolbar').getByTestId('day-timer');
	const clock = timer.getByRole('timer');
	await expect(clock).toHaveText('4:00');
	// The mode is named on the timer, and tapping the clock switches it (Trevor, 2026-10-17).
	await expect(timer.getByTestId('timer-mode')).toHaveText('Timer');
	const height = (await timer.boundingBox())!.height;
	await timer.getByRole('button', { name: 'Timer; switch to stopwatch' }).tap();
	await expect(timer.getByTestId('timer-mode')).toHaveText('Stopwatch');
	await expect(clock).toHaveText('0:00');
	expect((await timer.boundingBox())!.height).toBe(height);
	await timer.getByRole('button', { name: 'Start timer' }).tap();
	await page.clock.runFor(61_000);
	await expect(clock).toHaveText('1:01');
	await page.clock.runFor(190_000);
	// Past 4:00 it turns red and keeps counting.
	await expect(timer).toHaveAttribute('data-done', '');
	await expect(clock).toHaveText('4:11');
	await expect(timer.getByRole('button', { name: 'Pause timer' })).toBeEnabled();
	// The choice is kept.
	await page.reload();
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(
		page
			.getByTestId('day-toolbar')
			.getByTestId('day-timer')
			.getByRole('button', { name: 'Stopwatch; switch to timer' })
	).toBeVisible();
});

// A script's homebrew character shows its own name in the day view, never its id (Trevor,
// 2026-10-17: Fall of Rome's Spartacus read as "spartacusfallofrome").
test('the day view names a homebrew character by its script name', async ({ page }) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(
		JSON.stringify([
			{ id: '_meta', name: 'Homebrew Day' },
			{
				id: 'spartacus_fallofrome',
				name: 'Spartacus',
				team: 'townsfolk',
				ability: 'You do something heroic.'
			},
			'chef',
			'empath',
			'spy',
			'imp'
		])
	);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Homebrew Day');

	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Homebrew Day').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Spartacus', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day' });
	await seat(page, 'Seat 1').tap();
	await page
		.getByRole('dialog', { name: 'How did Seat 1 die?' })
		.getByRole('button', { name: 'Killed by the Demon' })
		.tap();
	const announcements = page.getByTestId('announcements');
	await expect(announcements).toContainText('Spartacus');
	await expect(announcements.locator('img')).toHaveCount(1);
	await expect(day).not.toContainText('spartacusfallofrome');
});

// Tapping the board's timer opens its controls and settings over the board, without the
// day view, and nothing there leads into Settings (Trevor, 2026-10-17).
test('the board timer opens its own controls and settings', async ({ page }) => {
	await page.clock.install();
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await page.getByTestId('day-toolbar').getByRole('button', { name: 'Start timer' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Day' })).toBeHidden();

	const board = page.locator('.board-timer').getByTestId('day-timer');
	await board.getByRole('button', { name: /^Day timer, \d+:\d\d; open its controls$/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Day timer' });
	await expect(sheet).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Day', exact: true })).toHaveCount(0);
	const timer = sheet.getByTestId('day-timer');
	await expect(timer.getByRole('button', { name: 'Pause timer' })).toBeVisible();
	await expect(timer.getByRole('button', { name: '30 seconds more' })).toBeVisible();
	// The sound is chosen right here, so the timer's own sound button is left out.
	await expect(timer.getByRole('button', { name: /^Timer sound/ })).toHaveCount(0);

	// Tapping the clock switches timer and stopwatch; there is no drop-down for it (Trevor).
	await expect(sheet.getByRole('combobox', { name: 'Mode' })).toHaveCount(0);
	await timer.getByRole('button', { name: 'Timer; switch to stopwatch' }).tap();
	await expect(timer.getByTestId('timer-mode')).toHaveText('Stopwatch');
	await sheet.getByRole('combobox', { name: 'Timer sound' }).tap();
	await page.getByRole('option', { name: 'Chime', exact: true }).tap();
	await expect(sheet.getByRole('combobox', { name: 'Timer sound' })).toContainText('Chime');
	// Vibration is its own switch beside the sound (Trevor, 2026-10-18).
	const vibrate = sheet.getByRole('checkbox', { name: 'Vibrate' });
	await expect(vibrate).toBeChecked();
	await sheet.getByText('Vibrate', { exact: true }).tap();
	await expect(vibrate).not.toBeChecked();
	await expect(sheet.getByRole('link')).toHaveCount(0);

	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(board).toBeVisible();
	// The choices are the same settings the day view uses.
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(page.getByTestId('day-toolbar').getByTestId('timer-mode')).toHaveText('Stopwatch');
});

test('End day closes the day and opens tonight’s night order at Dusk', async ({ page }) => {
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day' });
	await day.getByRole('button', { name: 'End day' }).tap();
	// Ending the day changes the game, so it asks first (Trevor).
	const confirm = page.getByRole('alertdialog', { name: 'End the day?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(day).toBeHidden();
	const night = page.getByRole('dialog', { name: 'Night order' });
	await expect(night).toBeVisible();
	await expect(night.getByRole('button', { name: 'Done: Dusk' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
