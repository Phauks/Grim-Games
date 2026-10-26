import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// The day sheet over the board of a saved game: executions, exiles and deaths, all
// by hand, each with a cause from the valid ones. Nominations happen off the grimoire.

async function startGame(page: Page, players = 8, script = 'Trouble Brewing') {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText(script, { exact: true }).tap();
	for (let i = 8; i < players; i++) await page.getByRole('button', { name: 'More players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(players);
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

/** The day sheet, Day before the first night and Day N after it. */
const daySheet = (page: Page) => page.getByRole('dialog', { name: /^Day( \d+)?$/ });

async function openDay(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(daySheet(page)).toBeVisible();
	return daySheet(page);
}

/** Closes the day sheet, so the board behind it can be used (Trevor, 2026-10-20). */
async function closeDay(page: Page) {
	await daySheet(page).getByRole('button', { name: 'Close' }).tap();
	await expect(daySheet(page)).toBeHidden();
}

const seatSheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

/** Opens a seat on the board: deaths, causes and ghost votes are marked there. */
async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await expect(seatSheet(page).getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return seatSheet(page);
}

async function closeSeat(page: Page) {
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();
}

/** The Status dialog of a living seat on the board, listing the causes that fit. */
async function openStatus(page: Page, number: number) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	const status = page.getByRole('dialog', { name: `Status of Seat ${number}` });
	await expect(status).toBeVisible();
	return status;
}

/** Marks a seat dead on the board, with its cause. */
async function markDead(page: Page, number: number, cause: string) {
	const status = await openStatus(page, number);
	await status.getByRole('button', { name: cause, exact: true }).tap();
	await expect(status).toBeHidden();
	await closeSeat(page);
}

/** Toggles a dead seat's ghost vote on the board. */
async function toggleGhostVote(page: Page, number: number) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Ghost vote' }).tap();
	await closeSeat(page);
}

async function chooseCharacter(page: Page, number: number, name: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${number}` })
		.getByRole('button', { name: new RegExp(`^${name}(, Recommended)?$`) })
		.tap();
	await closeSeat(page);
}

/** A seat on the board by the start of its label, while a sheet hides the board. */
/** Ending the day asks who was executed (Trevor, 2026-10-22). */
async function endTheDay(page: Page, choice = 'No execution') {
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	// A player's option goes on to their character and alive or dead (Trevor, 2026-10-23).
	await page.getByRole('option', { name: new RegExp(`^${choice}(\\s|$)`) }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

const boardSeat = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

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
	// Only official characters, so no note about custom ones (L28).
	await expect(page.getByTestId('custom-announcements')).toHaveCount(0);
	// Living players and each team's, beside the votes (Trevor, 2026-10-17).
	// Living of all players, as 8/8 (Trevor, 2026-10-17).
	await expect(page.getByTestId('alive-count')).toHaveText('8/8');
	// No characters yet, so no team has anyone.
	await expect(page.getByTestId('alive-good')).toHaveAccessibleName('0 good alive');
	await expect(page.getByTestId('alive-evil')).toHaveText('0');
	// Ghost votes still to use sit beside the living (Trevor, 2026-10-17).
	await expect(page.getByTestId('ghost-votes')).toHaveText('0');
	// The ghost is filled, like an unused ghost vote on the board (Trevor, 2026-10-19).
	await expect(page.getByTestId('ghost-votes').locator('[data-icon$="-fill"]')).toHaveCount(1);
	// Each count is filled in a colour of its own (Trevor, 2026-10-20: L21).
	const fills = await page
		.getByTestId('day-toolbar')
		.locator('.counts > .badge')
		.evaluateAll((els) =>
			els.map((el) => {
				const style = getComputedStyle(el);
				return `${style.backgroundColor} ${style.backgroundImage}`;
			})
		);
	expect(new Set(fills).size).toBe(5);
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
		.locator('.counts > .badge')
		.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
	expect(tops).toHaveLength(5);
	expect(new Set(tops).size).toBe(1);
	// No Players section (Trevor, 2026-10-20): the board marks deaths, causes and ghost votes.
	await expect(day.getByRole('heading', { name: 'Players' })).toHaveCount(0);
	await expect(day.getByRole('button', { name: /^Seat: / })).toHaveCount(0);
	// The Announcements header folds with its caret; closed, it says how many it holds.
	const announcementsHead = day.getByRole('button', { name: 'Announcements', exact: true });
	await announcementsHead.tap();
	await expect(page.getByTestId('announcements')).toBeHidden();
	await expect(announcementsHead.getByTestId('section-count')).toHaveText('0');
	await announcementsHead.tap();
	await expect(page.getByTestId('announcements')).toBeVisible();
	await expect(announcementsHead.getByTestId('section-count')).toHaveCount(0);

	// No nomination tracking, log, Undo or History here (Trevor, 2026-10-16).
	await expect(page.getByRole('radiogroup', { name: 'Tapping a player' })).toHaveCount(0);
	await expect(page.getByTestId('day-log')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'History' })).toHaveCount(0);

	// An execution is marked on the board; the day view follows it.
	await closeDay(page);
	await markDead(page, 2, 'Executed');
	await openDay(page);
	// A day death is not an announcement: those are the night's, for dawn (Trevor, 2026-10-18).
	await expect(page.getByTestId('announcements')).toHaveText('None');
	await expect(page.getByTestId('alive-count')).toHaveText('7/8');
	await expect(page.getByTestId('ghost-votes')).toHaveText('1');
	// The ghost vote used on the board, then given back, is counted here.
	await closeDay(page);
	await toggleGhostVote(page, 2);
	await openDay(page);
	await expect(page.getByTestId('ghost-votes')).toHaveText('0');
	await closeDay(page);
	await toggleGhostVote(page, 2);
	await openDay(page);
	await expect(page.getByTestId('ghost-votes')).toHaveText('1');

	// Each count opens how it was worked out, as a table (Trevor, 2026-10-19).
	const table = page.getByTestId('count-table');
	const closeCount = async () => {
		await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).tap();
		await expect(table).toBeHidden();
	};
	await page.getByTestId('alive-count').tap();
	// The team split is left to the team counts (Trevor, 2026-10-19).
	await expect(page.getByRole('dialog', { name: '7 of 8 players alive' })).toBeVisible();
	// The total reads as a sum, bold.
	expect(
		await table.locator('tfoot td').evaluate((el) => Number(getComputedStyle(el).fontWeight))
	).toBeGreaterThanOrEqual(700);
	await expect(table.locator('tbody tr')).toHaveCount(8);
	await expect(table.locator('tr[data-seat]:not([data-counts])')).toHaveText(/Seat 2.*Dead/);
	await expect(table.locator('tfoot')).toHaveText(/Total\s*7/);
	await page.screenshot({ path: `test-results/day-count-${test.info().project.name}.png` });
	await closeCount();
	await page.getByTestId('ghost-votes').tap();
	await expect(table.locator('tbody tr')).toHaveCount(1);
	await expect(table.locator('tbody tr')).toHaveText(/Seat 2.*Unused/);
	await closeCount();
	await page.getByTestId('votes-needed').tap();
	await expect(table).toHaveText(/Living players\s*7\s*Half, rounded up\s*4/);
	await closeCount();
	// No characters yet, so the teams list nobody.
	await page.getByTestId('alive-evil').tap();
	await expect(table.locator('tbody')).toHaveText('None');
	await closeCount();
	// Every count is filled, the number on top: the teams in their colour (Trevor, 2026-10-19).
	for (const id of ['alive-count', 'alive-good', 'alive-evil', 'ghost-votes', 'votes-needed']) {
		const fill = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(fill, id).not.toBe('rgba(0, 0, 0, 0)');
	}

	await page.reload();
	await openDay(page);
	await expect(page.getByTestId('alive-count')).toHaveText('7/8');
	// 7 of 8 alive: 4 votes put a player on the block.
	const votes = page.getByTestId('votes-needed');
	await expect(votes).toHaveText('4');
	await expect(votes).toHaveAttribute(
		'aria-label',
		'4 votes put the first nominee on the block (7 alive)'
	);

	// Closing the sheet shows the board behind it, already updated.
	await closeDay(page);
	await expect(
		page.getByRole('button', { name: /^Seat 2: no name, no character, dead/ })
	).toBeAttached();
});

test("the day's sections fold with their caret and their headers stick under the toolbar", async ({
	page
}) => {
	// Twelve seats and their characters to set: about 25s locally, so room on a loaded runner.
	test.setTimeout(90_000);
	await startGame(page, 12);
	// Characters whose pre-day reminders fill the day with sections to scroll.
	for (const [number, name] of [
		[1, 'Undertaker'],
		[2, 'Slayer'],
		[3, 'Mayor'],
		[4, 'Virgin'],
		[5, 'Butler'],
		[6, 'Saint'],
		[7, 'Scarlet Woman'],
		[8, 'Imp']
	] as const) {
		await chooseCharacter(page, number, name);
	}
	// And deaths in the night to announce.
	for (const number of [9, 10, 11, 12]) await markDead(page, number, 'The Demon');
	const day = await openDay(page);
	await expect(page.getByTestId('announcements').getByTestId('spoken')).toHaveCount(4);
	const toolbar = page.getByTestId('day-toolbar');
	const sections = day.locator('.sections > .collapsible');
	expect(await sections.count()).toBeGreaterThan(2);
	// No Players section (Trevor, 2026-10-20); the Slayer's Used sits on the Slayer's own row.
	await expect(day.getByRole('heading', { name: 'Players' })).toHaveCount(0);
	await expect(
		day.locator('li[data-character="slayer"]').getByRole('button', { name: /^Used: Slayer/ })
	).toBeVisible();

	// Each section folds away with its caret, its count shown while closed.
	for (let i = 0; i < (await sections.count()); i++) {
		const toggle = sections.nth(i).locator('> .head').getByRole('button').first();
		const body = sections.nth(i).locator('> .body');
		await toggle.tap();
		await expect(body).toBeHidden();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle.getByTestId('section-count')).toBeVisible();
		await toggle.tap();
		await expect(body).toBeVisible();
	}
	// Closed, Announcements counts what it lists: the four deaths.
	const announcementsHead = day.getByRole('button', { name: 'Announcements', exact: true });
	await announcementsHead.tap();
	await expect(announcementsHead.getByTestId('section-count')).toHaveText('4');
	await announcementsHead.tap();

	// A section's header stays just under the toolbar while its content scrolls (Trevor).
	const scroller = toolbar.locator('xpath=../..');
	// Announcements, scrolled until its top has passed under the toolbar.
	const section = day.locator('.sections > .collapsible', {
		has: page.getByTestId('announcements')
	});
	const head = section.locator('> .head');
	const toolbarBottom = async () => {
		const box = (await toolbar.boundingBox())!;
		return box.y + box.height;
	};
	await scroller.evaluate((el) => el.scrollTo(0, 0));
	const sectionTop = (await section.boundingBox())!.y;
	const by = sectionTop - (await toolbarBottom()) + 40;
	await scroller.evaluate((el, by) => el.scrollBy(0, by), by);
	expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	// The section's own top is now behind the toolbar.
	expect((await section.boundingBox())!.y).toBeLessThan(await toolbarBottom());
	await expect(toolbar).toBeInViewport();
	await expect(head).toBeInViewport();
	const toolbarBox = (await toolbar.boundingBox())!;
	const headBox = (await head.boundingBox())!;
	// Tucked just under the toolbar, its content scrolled up behind it.
	expect(headBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height - 1);
	expect(headBox.y).toBeLessThan(toolbarBox.y + toolbarBox.height + 1);
});

test('a Traveller is exiled, and a death offers only valid causes', async ({ page }) => {
	const board = await startGame(page);
	await addThief(page);
	// The old day link opens the day sheet over the board.
	await page.goto(`${board}/day`);
	await expect(page).toHaveURL(board);
	await expect(page.getByRole('dialog', { name: 'Day' })).toBeVisible();

	await expect(page.getByTestId('alive-count')).toHaveText('9/9');
	// Deaths are marked on the board's Status dialog (Trevor, 2026-10-20).
	await closeDay(page);
	const thief = await openStatus(page, 9);
	// A Traveller is exiled, not executed.
	await expect(thief.locator('button.cause')).toHaveText(['Alive', 'Exiled', 'The Demon']);
	await expect(thief.getByRole('button', { name: 'Cancel' })).toBeVisible();
	await thief.getByRole('button', { name: 'Exiled' }).tap();
	await closeSeat(page);
	await expect(boardSeat(page, 'Seat 9: no name, Thief')).toHaveAccessibleName(/dead/);

	// No characters are in play, so no character is offered.
	const causes = await openStatus(page, 3);
	await expect(causes.locator('button.cause')).toHaveText(['Alive', 'Executed', 'The Demon']);
	await causes.getByRole('button', { name: 'The Demon', exact: true }).tap();
	await expect(causes).toBeHidden();
	await closeSeat(page);

	const day = await openDay(page);
	// 7 of 9 alive (the Thief exiled, Seat 3 dead): 4 votes.
	await expect(page.getByTestId('alive-count')).toHaveText('7/9');
	await expect(page.getByTestId('votes-needed')).toHaveAttribute('aria-label', /\(7 alive\)$/);
	// The Demon's kill is announced; the exile, a day death, is not.
	const announcements = page.getByTestId('announcements');
	await expect(announcements.getByTestId('spoken')).toHaveText([
		'The player in seat 3 died in the night.'
	]);
	await expect(announcements.getByTestId('storyteller-only')).toHaveText(
		'No character, killed by the Demon'
	);
	// Closed, the Announcements header counts what it lists.
	const head = day.getByRole('button', { name: 'Announcements', exact: true });
	await head.tap();
	await expect(head.getByTestId('section-count')).toHaveText('1');
	await head.tap();
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
	await closeDay(page);
	await markDead(page, 2, 'Executed');
	await openDay(page);
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
	await page.getByTestId('announcements').scrollIntoViewIfNeeded();
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
	// More and less change the time shown in both modes (Trevor, 2026-10-23).
	await timer.getByRole('button', { name: '30 seconds more' }).tap();
	await expect(clock).toHaveText('0:30');
	await timer.getByRole('button', { name: '30 seconds less' }).tap();
	await timer.getByRole('button', { name: '30 seconds less' }).tap();
	await expect(clock).toHaveText('0:00');
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
	await pickScript(page, 'Homebrew Day');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Spartacus', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	await markDead(page, 1, 'The Demon');
	const day = await openDay(page);
	const announcements = page.getByTestId('announcements');
	// The words to say by seat, never the character; the character and cause only for the
	// Storyteller, in italics (Trevor, 2026-10-19).
	await expect(announcements.getByTestId('spoken')).toHaveText(
		'The player in seat 1 died in the night.'
	);
	await expect(announcements.getByTestId('storyteller-only')).toHaveText(
		/Spartacus.*, killed by the Demon/
	);
	await expect(announcements).toContainText('Spartacus');
	// A custom character is in play, so some announcements may be missing (Trevor, L28).
	await expect(day.getByTestId('custom-announcements')).toHaveText(
		'Custom characters: not every announcement may be listed here.'
	);
	// The words are italic; the character's name stays upright (Trevor, 2026-10-19).
	await expect(announcements.getByTestId('storyteller-only').locator('.badge')).toHaveCSS(
		'font-style',
		'normal'
	);
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
	await sheet.getByRole('combobox', { name: 'Timer sound' }).tap();
	await page.getByRole('option', { name: 'Chime', exact: true }).tap();
	await expect(sheet.getByRole('combobox', { name: 'Timer sound' })).toContainText('Chime');
	await timer.getByRole('button', { name: 'Timer; switch to stopwatch' }).tap();
	await expect(timer.getByTestId('timer-mode')).toHaveText('Stopwatch');
	// A stopwatch plays no sound, so its choice is greyed in place (Trevor, 2026-10-23).
	await expect(sheet.getByRole('combobox', { name: 'Timer sound' })).toBeDisabled();
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

test('the time per living player is set on the timer and starts it at that much', async ({
	page
}) => {
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const timer = page.getByTestId('day-toolbar').getByTestId('day-timer');
	await expect(timer.getByRole('timer')).toHaveText('4:00');
	// Trevor (2026-10-19): a setting, 30 seconds by default, on the timer and in Settings.
	await timer.getByRole('button', { name: /^Timer sound/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Timer sound' });
	const seconds = sheet.getByTestId('timer-per-player');
	await expect(seconds).toHaveValue('30');
	await seconds.fill('45');
	await seconds.press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	// 8 living players at 45 seconds each.
	await expect(timer.getByRole('timer')).toHaveText('6:00');
});

test('Execution ends the day and walks through tonight from Dusk', async ({ page }) => {
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day' });
	// Execution in place of End day (Trevor, 2026-10-22).
	await expect(day.getByRole('button', { name: 'End day' })).toHaveCount(0);
	await day.getByRole('button', { name: 'Execution' }).tap();
	// Ending the day asks who was executed; nothing is chosen until the Storyteller picks.
	const confirm = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(confirm.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await confirm.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: 'No execution', exact: true }).tap();
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(day).toBeHidden();
	// Dusk is ticked, so the night runs: the walk-through is on the board (the night order left
	// it, Trevor 2026-10-18) and the bank's button is End night.
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect(
		page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: 'End night', exact: true })
	).toBeEnabled();
});

// https://wiki.bloodontheclocktower.com/Flowergirl and /Town_Crier (How to Run: each day ends
// with one of the two tokens on them).
test('Execution asks whether the Demon voted and a Minion nominated, and places their tokens', async ({
	page
}) => {
	await startGame(page, 8, 'Sects & Violets');
	await chooseCharacter(page, 3, 'Flowergirl');
	await chooseCharacter(page, 4, 'Town Crier');
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Day' }).getByRole('button', { name: 'Execution' }).tap();
	// Trevor (2026-10-24): "On day end, it should confirm demon did not vote".
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	const voted = ask.getByRole('checkbox', { name: 'Demon voted', includeHidden: true });
	const nominated = ask.getByRole('checkbox', { name: 'Minion nominated', includeHidden: true });
	await expect(voted).not.toBeChecked();
	await expect(nominated).not.toBeChecked();
	await ask.getByText('Minion nominated', { exact: true }).tap();
	await expect(nominated).toBeChecked();
	await endTheDay(page);
	const token = (label: string) =>
		// Placed on the board, not waiting in the reminder bank.
		page.locator(
			`[data-testid="board-reminder"][aria-label="${label} reminder"]:not([aria-label="Reminder bank"] *)`
		);
	await expect(token('Demon Not Voted')).toHaveCount(1);
	await expect(token('Minion Nominated')).toHaveCount(1);
});

test('Execution names the player executed, who dies before tonight', async ({ page }) => {
	await startGame(page);
	await chooseCharacter(page, 3, 'Slayer');
	await markDead(page, 4, 'The Demon');
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Day' }).getByRole('button', { name: 'Execution' }).tap();
	// Each player as the seat chooser cites them: the character's badge, then alive or dead
	// (Trevor, 2026-10-23).
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	const slayer = page.getByRole('option', { name: /^Seat 3\b/ });
	await expect(slayer).toContainText('Slayer');
	await expect(slayer).toContainText('Alive');
	await expect(page.getByRole('option', { name: /^Seat 4\b/ })).toContainText('Dead');
	await slayer.tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect(boardSeat(page, 'Seat 3')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 2')).not.toHaveAccessibleName(/dead/);
});

// https://wiki.bloodontheclocktower.com/Butcher: after the day's first execution, the Butcher
// may nominate again.
test('Execution offers to keep the day going while the Butcher may still nominate', async ({
	page
}) => {
	await startGame(page);
	// Trevor (2026-10-26): "Offer to keep the day going".
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: /^Butcher(,|$)/ }).tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await closeSeat(page);
	const day = await openDay(page);
	await day.getByRole('button', { name: 'Execution', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	const keep = ask.getByRole('checkbox', { name: 'Keep the day going', includeHidden: true });
	// There from the start, so choosing never moves the buttons; off until a choice allows it.
	await expect(keep).toBeDisabled();
	const choose = async (choice: string) => {
		await ask.getByRole('combobox', { name: 'Execution' }).tap();
		await page.getByRole('option', { name: new RegExp(`^${choice}(\\s|$)`) }).tap();
	};
	// The Butcher executed dies, so has no nomination left.
	await choose('Seat 1');
	await expect(keep).toBeDisabled();
	await choose('Seat 2');
	await expect(keep).toBeEnabled();
	await expect(keep).not.toBeChecked();
	await ask.getByText('Keep the day going', { exact: true }).tap();
	await expect(keep).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// Seat 2 is executed and the day goes on.
	await expect(ask).toBeHidden();
	await expect(day).toBeVisible();
	await expect(page.getByTestId('night-strip')).toHaveCount(0);
	// The day sheet hides the board from the accessibility tree, so its mark is read instead.
	await expect(boardSeat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');
	// Execution again, with today's execution chosen: off, so Confirm ends the day.
	await day.getByRole('button', { name: 'Execution', exact: true }).tap();
	await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 2');
	await expect(keep).not.toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
});

test("Executed in a seat's status during the day asks as Execution does; a Sailor does not die", async ({
	page
}) => {
	test.setTimeout(90_000);
	// https://wiki.bloodontheclocktower.com/Sailor: the Sailor can't die.
	await startGame(page, 8, 'Bad Moon Rising');
	await chooseCharacter(page, 3, 'Sailor');
	// Night 1 runs from the day's Execution, then the night ends: day 2.
	await openDay(page);
	await daySheet(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	await endTheDay(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	await bank.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await closeDay(page);
	// The same as the day's Execution (Trevor, 2026-10-23): it asks, with the seat chosen.
	const status = await openStatus(page, 3);
	await status.getByRole('button', { name: 'Executed', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(ask).toBeVisible();
	await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 3');
	// Executed and does not die, named by the rule that saves them, before Confirm.
	await expect(ask.getByTestId('execution-saved')).toContainText(
		'Seat 3 has been executed and does not die'
	);
	await expect(ask.getByTestId('execution-saved')).toContainText('Sailor');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect(boardSeat(page, 'Seat 3')).not.toHaveAccessibleName(/dead/);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'History' })
		.tap();
	await expect(page.getByRole('dialog', { name: 'History' })).toContainText(
		'Seat 3 has been executed and does not die'
	);
});

test("Execution's Saved by applies the Pacifist the Storyteller picks", async ({ page }) => {
	// https://wiki.bloodontheclocktower.com/Pacifist: an executed good player might not die,
	// the Storyteller's choice (Trevor, 2026-10-24: a modifier slot in the execution area).
	await startGame(page, 8, 'Bad Moon Rising');
	await chooseCharacter(page, 3, 'Pacifist');
	const day = await openDay(page);
	await day.getByRole('button', { name: 'Execution', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	// Disabled until a living player is chosen, so nothing moves (no reflow).
	const savedBy = ask.getByRole('combobox', { name: 'Saved by' });
	await expect(savedBy).toBeDisabled();
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /^Seat 3\b/ }).tap();
	// The grimoire never applies the Pacifist unasked: None until the Storyteller picks it.
	await expect(savedBy).toContainText('None');
	await expect(ask.getByTestId('execution-saved')).not.toContainText('does not die');
	await savedBy.tap();
	await page.getByRole('option', { name: /Pacifist/ }).tap();
	await expect(ask.getByTestId('execution-saved')).toContainText(
		'Seat 3 has been executed and does not die'
	);
	await expect(ask.getByTestId('execution-saved')).toContainText('Pacifist');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect(boardSeat(page, 'Seat 3')).not.toHaveAccessibleName(/dead/);
});

test('an unnamed seat is named by its number in the day view', async ({ page }) => {
	await startGame(page);
	await chooseCharacter(page, 3, 'Slayer');
	const day = await openDay(page);
	// No name set, so the default "Seat N" (Trevor, 2026-10-22: L32).
	await expect(day.locator('li[data-character="slayer"]').first()).toContainText('Seat 3');
});

test('Announcements name a player brought back to life in the night', async ({ page }) => {
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	const endNight = async () => {
		await bank.getByRole('button', { name: 'End night', exact: true }).tap();
		await page
			.getByRole('alertdialog', { name: 'End the night?' })
			.getByRole('button', { name: 'Confirm' })
			.tap();
	};
	await openDay(page);
	await daySheet(page).getByRole('button', { name: 'Execution' }).tap();
	await endTheDay(page);
	// Night 1: seat 2 dies.
	await markDead(page, 2, 'The Demon');
	await endNight();
	await closeDay(page);
	await bank.getByRole('button', { name: 'Execution', exact: true }).tap();
	await endTheDay(page);
	// Night 2: seat 2 comes back (the Professor, say).
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('button', { name: /^Status/ }).tap();
	const status = page.getByRole('dialog', { name: 'Status of Seat 2' });
	await status.getByRole('button', { name: 'Alive', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: /back to life\?$/ })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await closeSeat(page);
	await endNight();
	// Announcements must include people being revived (Trevor, 2026-10-20: L9).
	const announcements = daySheet(page).getByTestId('announcements');
	await expect(announcements.getByTestId('revived')).toContainText(
		'The player in seat 2 is alive.'
	);
	await expect(announcements).toContainText('Nobody died in the night.');
});

test('holding the day timer or a new day resets it to the time per living player', async ({
	page
}) => {
	await startGame(page);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	let day = page.getByRole('dialog', { name: 'Day' });
	const clock = day.getByTestId('day-toolbar').getByRole('timer');
	await expect(clock).toHaveText('4:00');
	// Changed by hand: that lasts for this day only.
	await day.getByRole('button', { name: '30 seconds less' }).tap();
	await expect(clock).toHaveText('3:30');
	// Holding the clock resets it (Trevor, 2026-10-19); the hold is not also a tap.
	const mode = day.getByTestId('timer-mode');
	const caption = await mode.textContent();
	await clock.hover();
	await page.mouse.down();
	await page.waitForTimeout(800);
	await page.mouse.up();
	await expect(clock).toHaveText('4:00');
	await expect(mode).toHaveText(caption ?? '');
	await day.getByRole('button', { name: '30 seconds less' }).tap();
	await expect(clock).toHaveText('3:30');
	await day.getByRole('button', { name: 'Execution' }).tap();
	await endTheDay(page);
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	// The day opens after End night; the timer starts again at 8 players' time (Trevor, 2026-10-19).
	day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day.getByTestId('day-toolbar').getByRole('timer')).toHaveText('4:00');
	await expect(day.getByRole('button', { name: 'Start timer' })).toBeEnabled();
	// After a night with no deaths, that is the announcement (Trevor, 2026-10-19).
	await expect(day.getByTestId('announcements')).toHaveText('Nobody died in the night.');
});

test('a wide day view puts the toolbar beside the sections', async ({ page }) => {
	await startGame(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	// Two columns on a wide screen (Trevor, 2026-10-23: L45).
	const toolbar = await page.getByTestId('day-toolbar').boundingBox();
	const announcements = await page.getByTestId('announcements').boundingBox();
	expect(announcements!.x).toBeGreaterThan(toolbar!.x + toolbar!.width - 1);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect
		.poll(async () => (await page.getByTestId('announcements').boundingBox())!.y)
		.toBeGreaterThan((await page.getByTestId('day-toolbar').boundingBox())!.y);
});

test('ending the game at an Execution closes the walk-through and moves nothing', async ({
	page
}) => {
	await startGame(page);
	await chooseCharacter(page, 3, 'Imp');
	const corner = page.getByTestId('script-title');
	const seat = boardSeat(page, 'Seat 1');
	const before = { corner: await corner.boundingBox(), seat: await seat.boundingBox() };
	// The Demon executed: good wins (https://wiki.bloodontheclocktower.com/Imp).
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Day' }).getByRole('button', { name: 'Execution' }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /^Seat 3\b/ }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm' }).tap();
	await expect(end).toBeHidden();
	await page.keyboard.press('Escape');

	// One strip at the bottom (Trevor, 2026-10-24): History's; the night's walk-through closes
	// once the game is over. Game over is a status above Game info (the corner), out of the
	// strip (Trevor, 2026-10-25).
	const over = page.getByTestId('game-over');
	await expect(over).toHaveText('Game over: Good won');
	await expect(page.getByTestId('night-strip')).toHaveCount(0);
	await expect(page.getByTestId('history-strip').getByTestId('game-over')).toHaveCount(0);
	const pill = (await over.boundingBox())!;
	expect(pill.y + pill.height).toBeLessThanOrEqual(before.corner!.y + 1);
	// Nothing moves when the game ends: the corner and the seats stay where they were.
	for (const [box, was] of [
		[await corner.boundingBox(), before.corner],
		[await seat.boundingBox(), before.seat]
	]) {
		expect(Math.abs(box!.y - was!.y)).toBeLessThan(1);
		expect(Math.abs(box!.height - was!.height)).toBeLessThan(1);
	}
});

test('the corner, the day view and Resume agree on the night or day, without a start time', async ({
	page
}) => {
	test.setTimeout(90_000);
	// Trevor (2026-10-24): Resume said Day 4 where the day view said Day 3, and Game time said
	// Setup mid-game. This game never had Start game tapped, so the device has no start time.
	const path = await startGame(page);
	const phase = page.getByTestId('board-phase');
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	const endNight = async () => {
		await bank.getByRole('button', { name: 'End night', exact: true }).tap();
		await page
			.getByRole('alertdialog', { name: 'End the night?' })
			.getByRole('button', { name: 'Confirm' })
			.tap();
		if (await daySheet(page).isVisible()) await closeDay(page);
	};
	const resumed = async (text: string) => {
		await page.goto('/games');
		await expect(
			page.getByRole('link', { name: new RegExp(`Trouble Brewing.*${text} ·`) })
		).toBeVisible();
		await page.goto(path);
		await expect(page.getByTestId('seat')).toHaveCount(8);
	};

	await (await openDay(page)).getByRole('button', { name: 'Execution', exact: true }).tap();
	await endTheDay(page);
	await expect(phase).toHaveText('Night 1');
	await endNight();
	await expect(phase).toHaveText('Day 1');
	await expect(page.getByTestId('board-game-clock')).toContainText('None');
	await openDay(page);
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await daySheet(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	await endTheDay(page);
	// Tonight follows Day 1: Night 2 on the board and in Resume.
	await expect(phase).toHaveText('Night 2');
	await resumed('Night 2');
	await expect(phase).toHaveText('Night 2');
	await endNight();
	await expect(phase).toHaveText('Day 2');
	await openDay(page);
	await expect(page.getByRole('dialog', { name: 'Day 2' })).toBeVisible();
	await closeDay(page);
	await resumed('Day 2');
	await expect(phase).toHaveText('Day 2');
});

test('a game that ends at an Execution ends on that day', async ({ page }) => {
	test.setTimeout(90_000);
	await startGame(page);
	await chooseCharacter(page, 3, 'Imp');
	const phase = page.getByTestId('board-phase');
	await (await openDay(page)).getByRole('button', { name: 'Execution', exact: true }).tap();
	await endTheDay(page);
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	if (await daySheet(page).isVisible()) await closeDay(page);
	await expect(phase).toHaveText('Day 1');

	// Day 1's Execution ticks Dusk, then End game: the game ended on Day 1 (Trevor, 2026-10-24).
	await (await openDay(page)).getByRole('button', { name: 'Execution', exact: true }).tap();
	await endTheDay(page, 'Seat 3');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm' }).tap();
	await expect(end).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('game-over')).toBeVisible();
	await expect(phase).toHaveText('Day 1');
	await page.reload();
	await expect(page.getByTestId('board-phase')).toHaveText('Day 1');
});
