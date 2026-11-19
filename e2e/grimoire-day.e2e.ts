import { tapStartGame } from './start-game.ts';
import { paneDay, closePane, boardTimer, paneIsSheet, paneButton, openPane } from './players.ts';
import { walkThrough } from './night-step.ts';
import { chooseExecution, pickExecuted, startExecution, toDayOne } from './execution.ts';
import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';
import { putReminder } from './reminder-bank.ts';
import { addSeat } from './seating.ts';

// The day sheet over the board of a saved game: executions, exiles and deaths, all
// by hand, each with a cause from the valid ones. Nominations happen off the grimoire.

async function startGame(page: Page, players = 8, script = 'Trouble Brewing') {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText(script, { exact: true }).tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', players);
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(players);
	return new URL(page.url()).pathname;
}

async function addThief(page: Page) {
	await addTraveller(page, 'Thief, Recommended', 'Evil');
}

async function addTraveller(page: Page, choice: string, alignment: 'Good' | 'Evil') {
	// A Traveller joins as a new seat: Add seat (the board asks where), then choose them.
	await addSeat(page, 'Place between Seat 8 and Seat 1');
	await page.getByRole('button', { name: /^Seat 9:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 9' })
		.getByRole('button', { name: choice, exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: alignment })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	const name = choice.split(',')[0];
	await expect(
		page.locator(`[data-testid="seat"][aria-label^="Seat 9: no name, ${name}"]`)
	).toBeAttached();
}

/** The day sheet, Day before the first night and Day N after it. */
const daySheet = (page: Page) => page.getByTestId('pane-day');

async function openDay(page: Page) {
	await paneDay(page);
	await expect(daySheet(page)).toBeVisible();
	return daySheet(page);
}

/** Closes the day sheet, so the board behind it can be used (Trevor, 2026-10-20). */
async function closeDay(page: Page) {
	await closePane(page);
}

const seatSheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');
const seatAt = (page: Page, n: number) =>
	page.locator(`[data-testid="seat"][aria-label^="Seat ${n}:"]`);

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

/** The Status list of a living seat on the board (its drop-down), listing the causes that fit. */
async function openStatus(page: Page, number: number) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('combobox', { name: 'Status: Alive' }).tap();
	const status = page.getByRole('listbox');
	await expect(status).toBeVisible();
	return status;
}

/** Marks a seat dead on the board, with its cause. */
async function markDead(page: Page, number: number, cause: string) {
	const status = await openStatus(page, number);
	await status.getByRole('option', { name: cause, exact: true }).tap();
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
	await chooseExecution(page, choice);
}

const boardSeat = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

test('the day screen marks an execution, survives a reload and shows votes needed', async ({
	page
}) => {
	const board = await startGame(page);
	await paneDay(page);
	const day = page.getByTestId('pane-day');
	await expect(day).toBeVisible();
	await expect(page).toHaveURL(board);
	// Before anything happens there is nothing to announce (Trevor).
	await expect(page.getByTestId('announcements')).toHaveText('None');
	// Only official characters, so no note about custom ones (L28).
	await expect(page.getByTestId('custom-announcements')).toHaveCount(0);
	// One pill for the living: good on its blue half, the heart, evil on its red half (Trevor,
	// 2026-11-17, "B Folded into living"); the heart's name says how many of all are alive.
	await expect(page.getByTestId('alive-count')).toHaveAccessibleName('8 of 8 players alive');
	// No characters yet, so no team has anyone.
	await expect(page.getByTestId('alive-good')).toHaveAccessibleName('0 good alive');
	await expect(page.getByTestId('alive-evil')).toHaveText('0');
	// Ghost votes still to use sit beside the living (Trevor, 2026-10-17).
	await expect(page.getByTestId('ghost-votes')).toHaveText('0');
	// The ghost is filled, like an unused ghost vote on the board (Trevor, 2026-10-19).
	await expect(page.getByTestId('ghost-votes').locator('[data-icon$="-fill"]')).toHaveCount(1);
	// Each count is filled in a colour of its own (Trevor, 2026-10-20: L21): the living's one
	// pill (half blue, half red), the ghost votes and the votes.
	const fills = await page
		.getByTestId('day-counts')
		.locator('.teams, .badge.ghost, .badge.votes')
		.evaluateAll((els) =>
			els.map((el) => {
				const style = getComputedStyle(el);
				return `${style.backgroundColor} ${style.backgroundImage}`;
			})
		);
	expect(new Set(fills).size).toBe(3);
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
	// All the counts on one line (Trevor, 2026-10-17).
	const tops = await page
		.getByTestId('day-counts')
		.locator('.teams, .badge.ghost, .badge.votes')
		.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
	expect(tops).toHaveLength(3);
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
	await expect(page.getByTestId('alive-count')).toHaveAccessibleName('7 of 8 players alive');
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

	// Beside the board a count marks its seats there instead (Trevor, 2026-11-18: "clicking the
	// pills is not highlighting the board, it still opens modals"): the living glow, the dead fade.
	if (!(await paneIsSheet(page))) {
		const alive = page.getByTestId('alive-count');
		await alive.tap();
		await expect(alive).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(seatAt(page, 2)).toHaveAttribute('data-misfit');
		await expect(seatAt(page, 1)).toHaveAttribute('data-role', /target|both/);
		// Another count marks its own; tapped again, it stops.
		await page.getByTestId('ghost-votes').tap();
		await expect(alive).toHaveAttribute('aria-pressed', 'false');
		await expect(seatAt(page, 1)).toHaveAttribute('data-misfit');
		await expect(seatAt(page, 2)).not.toHaveAttribute('data-misfit');
		await page.getByTestId('ghost-votes').tap();
		await expect(seatAt(page, 1)).not.toHaveAttribute('data-misfit');
	} else {
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
		// No characters yet, so the teams list nobody.
		await page.getByTestId('alive-evil').tap();
		await expect(table.locator('tbody')).toHaveText('None');
		await closeCount();
	}
	// The votes: a short title, each threshold in its badge with a short line (Trevor,
	// 2026-11-01, option A).
	await page.getByTestId('votes-needed').tap();
	await expect(page.getByRole('dialog', { name: 'Votes needed' })).toBeVisible();
	await expect(page.getByTestId('count-votes')).toHaveText(/4\s*On the block · 7 alive/);
	await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByTestId('count-votes')).toBeHidden();
	// Every count is filled, the number on top: the teams in their colour (Trevor, 2026-10-19).
	// The living's three sit on their one pill, half blue and half red.
	const pill = page.getByTestId('day-counts').locator('.teams');
	expect(await pill.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('gradient');
	for (const id of ['ghost-votes', 'votes-needed']) {
		const fill = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(fill, id).not.toBe('rgba(0, 0, 0, 0)');
	}

	await page.reload();
	await openDay(page);
	await expect(page.getByTestId('alive-count')).toHaveAccessibleName('7 of 8 players alive');
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

test("the day's sections fold with their caret and their headers stick at the top", async ({
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
	const sections = day.locator('.sections > .collapsible');
	expect(await sections.count()).toBeGreaterThan(2);
	// No Players section (Trevor, 2026-10-20); the Slayer's Used sits on the Slayer's own row.
	await expect(day.getByRole('heading', { name: 'Players' })).toHaveCount(0);
	await expect(
		day.locator('li[data-character="slayer"]').getByRole('button', { name: /^Used: Slayer/ })
	).toBeVisible();
	// The Scarlet Woman's line counts the living: twelve seats, four dead.
	await expect(day.locator('li[data-character="scarletwoman"]')).toContainText(
		/Is alive,\s*8 players alive\./
	);

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

	// A section's header stays at the top while its content scrolls (Trevor); the counts sit
	// above the pane's tabs (Trevor, 2026-11-17), so nothing is pinned above it.
	const section = day.locator('.sections > .collapsible', {
		has: page.getByTestId('announcements')
	});
	const head = section.locator('> .head');
	const scroller = section.locator('xpath=ancestor::div[contains(@class, "day-pane")]');
	const top = async () => (await scroller.boundingBox())!.y;
	await scroller.evaluate((el) => el.scrollTo(0, 0));
	const by = (await section.boundingBox())!.y - (await top()) + 40;
	await scroller.evaluate((el, by) => el.scrollBy(0, by), by);
	expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	// The section's own top is now scrolled past, its header held at the top.
	expect((await section.boundingBox())!.y).toBeLessThan(await top());
	await expect(head).toBeInViewport();
	const headBox = (await head.boundingBox())!;
	expect(headBox.y).toBeGreaterThanOrEqual((await top()) - 2);
	expect(headBox.y).toBeLessThan((await top()) + 12);
});

// https://wiki.bloodontheclocktower.com/Deviant: whether they were funny is the Storyteller's call.
test('exiling a Deviant asks whether they survive', async ({ page }) => {
	await startGame(page);
	await addTraveller(page, 'Deviant', 'Good');
	const status = await openStatus(page, 9);
	await status.getByRole('option', { name: 'Exiled' }).tap();
	const ask = page.getByRole('dialog', { name: 'Does Seat 9 survive the exile?' });
	await expect(ask).toBeVisible();
	await expect(ask.locator('[data-exile-saver]')).toContainText('Deviant');
	await ask.getByRole('button', { name: 'Survives' }).tap();
	await expect(ask).toBeHidden();
	await closeSeat(page);
	await expect(boardSeat(page, 'Seat 9: no name, Deviant')).not.toHaveAccessibleName(/dead/);

	const again = await openStatus(page, 9);
	await again.getByRole('option', { name: 'Exiled' }).tap();
	await ask.getByRole('button', { name: 'Dies' }).tap();
	await expect(ask).toBeHidden();
	await closeSeat(page);
	await expect(boardSeat(page, 'Seat 9: no name, Deviant')).toHaveAccessibleName(/dead/);
});

// Votes are run outside the app; the votes dialog lists each unusual vote for the
// Storyteller's count (Trevor, 2026-11-01; M9e).
test('the votes dialog notes a Thief’s negative vote (M9e)', async ({ page }) => {
	await startGame(page);
	await addThief(page);
	await putReminder(page, 'Negative Vote', 2);
	await openDay(page);
	await page.getByTestId('votes-needed').tap();
	const notes = page.getByTestId('vote-notes');
	await expect(notes.locator('tbody tr')).toHaveCount(1);
	await expect(notes.locator('tbody tr')).toHaveText(/Seat 2.*Vote counts as -1/);
});

// The Master shows as a player badge, never a raw seat id (Trevor, 2026-11-02).
test('the votes dialog names the Butler’s Master as a player badge (M9e)', async ({ page }) => {
	await startGame(page);
	await chooseCharacter(page, 3, 'Butler');
	await putReminder(page, 'Master', 1);
	await openDay(page);
	await page.getByTestId('votes-needed').tap();
	const row = page.getByTestId('vote-notes').locator('tbody tr');
	await expect(row).toHaveCount(1);
	await expect(row).toHaveText(/Seat 3.*Votes only if\s*Seat 1\s*votes/);
	await expect(row).not.toContainText('-');
});

test('a Traveller is exiled, and a death offers only valid causes', async ({ page }) => {
	const board = await startGame(page);
	await addThief(page);
	// The old day link opens the day sheet over the board.
	await page.goto(`${board}/day`);
	await expect(page).toHaveURL(board);
	await expect(page.getByTestId('pane-day')).toBeVisible();

	await expect(page.getByTestId('alive-count')).toHaveAccessibleName('9 of 9 players alive');
	// Deaths are marked on the board's Status dialog (Trevor, 2026-10-20).
	await closeDay(page);
	const thief = await openStatus(page, 9);
	// A Traveller is exiled, not executed.
	await expect(thief.getByRole('option')).toHaveText([
		'Alive',
		'Not in play',
		'Exiled',
		'The Demon'
	]);
	await thief.getByRole('option', { name: 'Exiled' }).tap();
	await closeSeat(page);
	await expect(boardSeat(page, 'Seat 9: no name, Thief')).toHaveAccessibleName(/dead/);

	// No characters are in play, so no character is offered.
	const causes = await openStatus(page, 3);
	// Only a Traveller is offered Not in play (Trevor, 2026-11-02).
	await expect(causes.getByRole('option')).toHaveText(['Alive', 'Executed', 'The Demon']);
	await causes.getByRole('option', { name: 'The Demon', exact: true }).tap();
	await expect(causes).toBeHidden();
	await closeSeat(page);

	const day = await openDay(page);
	// 7 of 9 alive (the Thief exiled, Seat 3 dead): 4 votes.
	await expect(page.getByTestId('alive-count')).toHaveAccessibleName('7 of 9 players alive');
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
	// The board's timer, opened as its sheet: the only timer since the Day moved into the
	// pane (Trevor, 2026-11-16).
	let timer = await boardTimer(page);
	let clock = timer.getByRole('timer');
	// 8 players alive: 4 minutes.
	await expect(clock).toHaveText('4:00');
	await expect(timer.getByRole('button', { name: 'Reset timer' })).toBeDisabled();
	// A death before it starts follows the living players.
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('timer-sheet')).toBeHidden();
	await markDead(page, 2, 'Executed');
	timer = await boardTimer(page);
	clock = timer.getByRole('timer');
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
	// Red but still: no flashing (Trevor, 2026-11-15: "Don't flash the timer is done").
	expect(
		await clock.evaluate((el) => {
			const style = getComputedStyle(el);
			return [style.animationName, style.opacity];
		})
	).toEqual(['none', '1']);
	expect(await page.evaluate(() => (window as unknown as { vibrated: number }).vibrated)).toBe(1);
	// The finishing sound is the Storyteller's choice, kept as a setting, in the Timer sheet.
	const sounds = page.getByTestId('timer-sheet');
	await sounds.getByRole('combobox', { name: 'Timer sound' }).tap();
	// No None: silence is its own switch (Trevor, 2026-11-15).
	await expect(page.getByRole('option')).toHaveText([
		'Bell',
		'Chime',
		'Clock tower chimes',
		'Buzzer'
	]);
	await page.getByRole('option', { name: 'Chime', exact: true }).tap();
	await expect(sounds.getByRole('combobox', { name: 'Timer sound' })).toContainText('Chime');
	// "When timer is over, don't always make noise" (Trevor, 2026-11-15): a switch, which greys
	// the sound in place when off.
	const soundOn = sounds.getByRole('checkbox', { name: 'Sound when time is up' });
	await expect(soundOn).toBeChecked();
	await sounds.getByText('Sound when time is up', { exact: true }).tap();
	await expect(soundOn).not.toBeChecked();
	await expect(sounds.getByRole('combobox', { name: 'Timer sound' })).toBeDisabled();
	// Reset: back to 30 seconds per living player (7 alive).
	await timer.getByRole('button', { name: 'Reset timer' }).tap();
	await expect(clock).toHaveText('3:30');
	await expect(timer).not.toHaveAttribute('data-done', '');
	await page.keyboard.press('Escape');
	await expect(sounds).toBeHidden();
	await page.reload();
	await boardTimer(page);
	await expect(sounds.getByRole('combobox', { name: 'Timer sound' })).toContainText('Chime');
	await expect(sounds.getByRole('checkbox', { name: 'Sound when time is up' })).not.toBeChecked();
});

// Trevor, 2026-10-17: the timer can count up instead, past its target.
test('the day timer counts up past its target when set to', async ({ page }) => {
	await page.clock.install();
	await startGame(page);
	const timer = await boardTimer(page);
	const clock = timer.getByRole('timer');
	await expect(clock).toHaveText('4:00');
	// The mode is named on the timer (Trevor, 2026-10-17); its clock switches it.
	await expect(timer.getByTestId('timer-mode')).toHaveText('Timer');
	const height = (await timer.boundingBox())!.height;
	await timer.getByRole('button', { name: 'Timer; switch to stopwatch' }).tap();
	await expect(timer.getByTestId('timer-mode')).toHaveText('Stopwatch');
	await expect(clock).toHaveText('0:00');
	expect((await timer.boundingBox())!.height).toBeCloseTo(height, 0);
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
	await expect((await boardTimer(page)).getByTestId('timer-mode')).toHaveText('Stopwatch');
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
	await page.getByRole('button', { name: 'Create game' }).tap();
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
	const board = page.locator('.toolbar-timer').getByTestId('day-timer');
	await board.getByRole('button', { name: /^Day timer, \d+:\d\d; open its controls$/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Day timer' });
	await expect(sheet).toBeVisible();
	const timer = sheet.getByTestId('day-timer');
	await timer.getByRole('button', { name: 'Start timer' }).tap();
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
	await expect((await boardTimer(page)).getByTestId('timer-mode')).toHaveText('Stopwatch');
});

test('the time per living player is set on the timer and starts it at that much', async ({
	page
}) => {
	await startGame(page);
	const timer = await boardTimer(page);
	await expect(timer.getByRole('timer')).toHaveText('4:00');
	// Trevor (2026-10-19): a setting, 30 seconds by default, on the timer and in Settings.
	const sheet = page.getByTestId('timer-sheet');
	const seconds = sheet.getByTestId('timer-per-player');
	await expect(seconds).toHaveText('30 seconds');
	await pickNumber(sheet, 'Seconds per living player', '45 seconds');
	await expect(seconds).toHaveText('45 seconds');
	// 8 living players at 45 seconds each.
	await expect(timer.getByRole('timer')).toHaveText('6:00');
});

test('Execution ends the day and walks through tonight from Dusk', async ({ page }) => {
	await startGame(page);
	const day = await paneDay(page);
	// Execution in place of End day (Trevor, 2026-10-22), on the bank only (2026-11-16).
	await expect(day.getByRole('button', { name: 'End day' })).toHaveCount(0);
	await expect(day.getByRole('button', { name: 'Execution' })).toHaveCount(0);
	await startExecution(page);
	// Ending the day asks who was executed, on the board; nothing is chosen until then.
	const confirm = page.locator('[data-tray]').getByRole('button', { name: 'Confirm', exact: true });
	await expect(confirm).toBeDisabled();
	await pickExecuted(page, 'No execution');
	// Dusk is ticked, so the night runs: the walk-through shows and the bank's button is End
	// night.
	await expect(walkThrough(page)).toBeVisible();
	await expect(
		page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: 'End night', exact: true })
	).toBeEnabled();
});

// Before Start game the day view is Setup, and its Execution warns but still works (Trevor,
// 2026-11-01: the Storyteller overrides anything).
test('before Start game the bank has no Execution; once started, Execution asks on the board', async ({
	page
}) => {
	await startGame(page);
	await paneDay(page);
	await expect(page.getByRole('button', { name: 'Execution', exact: true })).toHaveCount(0);
	// Once started, Execution asks for the player on the board (Trevor, 2026-11-06), so no
	// warning shows.
	await startExecution(page);
	await expect(page.getByTestId('execution-pick')).toBeVisible();
	await expect(page.getByTestId('execution-not-started')).toHaveCount(0);
});

// Whether the Demon voted and a Minion nominated is asked on the Flowergirl's and Town Crier's
// night steps, not at Execution (Trevor, 2026-11-03).
test('Execution does not ask whether the Demon voted or a Minion nominated', async ({ page }) => {
	await startGame(page, 8, 'Sects & Violets');
	await chooseCharacter(page, 3, 'Flowergirl');
	await chooseCharacter(page, 4, 'Town Crier');
	await startExecution(page);
	const ask = page.getByTestId('execution-pick');
	await expect(ask).toBeVisible();
	await expect(ask.getByRole('checkbox', { name: 'Demon voted', includeHidden: true })).toHaveCount(
		0
	);
	await expect(
		ask.getByRole('checkbox', { name: 'Minion nominated', includeHidden: true })
	).toHaveCount(0);
});

test('Execution names the player executed, who dies before tonight', async ({ page }) => {
	await startGame(page);
	await chooseCharacter(page, 3, 'Slayer');
	await startExecution(page);
	await pickExecuted(page, 'Seat 3');
	await expect(walkThrough(page)).toBeVisible();
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
	await startExecution(page);
	// While the Butcher may nominate, picking a player opens the sheet (executionAsks).
	const ask = await pickExecuted(page, 'Seat 1');
	const keep = ask.getByRole('checkbox', { name: 'Keep the day going', includeHidden: true });
	const choose = async (choice: string) => {
		await ask.getByRole('combobox', { name: 'Execution' }).tap();
		await page.getByRole('option', { name: new RegExp(`\\b${choice}(\\s|$)`) }).tap();
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
	await expect(walkThrough(page)).toHaveCount(0);
	await expect(boardSeat(page, 'Seat 2')).toHaveAttribute('data-dead', 'true');
	// Execution again, with today's execution picked on the board: Confirm ends the day.
	await startExecution(page);
	await expect(page.getByTestId('execution-pick-question')).toContainText('Seat 2');
	await page.locator('[data-tray]').getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(walkThrough(page)).toBeVisible();
});

test("Executed in a seat's status during the day asks as Execution does; a Sailor does not die", async ({
	page
}) => {
	test.setTimeout(90_000);
	// https://wiki.bloodontheclocktower.com/Sailor: the Sailor can't die.
	await startGame(page, 8, 'Bad Moon Rising');
	await chooseCharacter(page, 3, 'Sailor');
	// Night 1, then day 1.
	await toDayOne(page);
	// The same as the day's Execution (Trevor, 2026-10-23): it asks, with the seat chosen.
	const status = await openStatus(page, 3);
	await status.getByRole('option', { name: 'Executed', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(ask).toBeVisible();
	await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 3');
	// Executed and does not die, named by the rule that saves them, before Confirm.
	await expect(ask.getByTestId('execution-saved')).toContainText(
		'Seat 3 has been executed and does not die'
	);
	await expect(ask.getByTestId('execution-saved')).toContainText('Sailor');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(walkThrough(page)).toBeVisible();
	await expect(boardSeat(page, 'Seat 3')).not.toHaveAccessibleName(/dead/);
	const pane = await openPane(page, 'History');
	await expect(pane.getByTestId('history')).toContainText(
		'Seat 3 has been executed and does not die'
	);
});

test("Execution's Saved by applies the Pacifist the Storyteller picks", async ({ page }) => {
	// https://wiki.bloodontheclocktower.com/Pacifist: an executed good player might not die,
	// the Storyteller's choice (Trevor, 2026-10-24: a modifier slot in the execution area).
	await startGame(page, 8, 'Bad Moon Rising');
	await chooseCharacter(page, 3, 'Pacifist');
	await startExecution(page);
	// A save in play: picking the player opens the sheet with them chosen.
	const ask = await pickExecuted(page, 'Seat 3');
	const savedBy = ask.getByRole('combobox', { name: 'Saved by' });
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
	await expect(walkThrough(page)).toBeVisible();
	await expect(boardSeat(page, 'Seat 3')).not.toHaveAccessibleName(/dead/);
});

test("Execution can execute a good Scapegoat in a good player's place (M12a)", async ({ page }) => {
	// https://wiki.bloodontheclocktower.com/Scapegoat: if a player of its alignment would be
	// executed, the Storyteller may execute the Scapegoat instead.
	await startGame(page);
	await chooseCharacter(page, 1, 'Chef');
	await chooseCharacter(page, 2, 'Imp');
	const sheet = await openSeat(page, 3);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 3' })
		.getByRole('button', { name: /^Scapegoat(, Recommended)?$/ })
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Good' }).tap();
	await closeSeat(page);
	await startExecution(page);
	// While the Scapegoat lives, picking a player opens the sheet (executionAsks).
	const ask = await pickExecuted(page, 'Seat 2');
	// There while the Scapegoat lives, disabled until a player of its alignment is chosen.
	const instead = ask.getByRole('checkbox', { name: 'Scapegoat is executed instead' });
	await expect(instead).toBeDisabled();
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /\bSeat 2\b/ }).tap();
	await expect(instead).toBeDisabled();
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /\bSeat 1\b/ }).tap();
	await expect(instead).toBeEnabled();
	await ask.getByTestId('executed-instead').locator('[data-part="control"]').tap();
	await expect(instead).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(walkThrough(page)).toBeVisible();
	await expect(boardSeat(page, 'Seat 3')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 1')).not.toHaveAccessibleName(/dead/);
});

test('executing the Boomdandy asks who lives, then who was pointed at most (M12b)', async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Boomdandy: executed, all but 3 players die; then
	// the player most pointed at dies.
	test.slow();
	await startGame(page, 6);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Boomdandy', exact: true }).tap();
	await closeSeat(page);
	await chooseCharacter(page, 2, 'Imp');
	await openDay(page);
	await startExecution(page);
	await endTheDay(page, 'Seat 1');
	const lives = page.getByRole('alertdialog', { name: 'Boomdandy: who lives?' });
	const note = lives.getByTestId('explosion-note');
	await expect(note).toHaveText('0 of 3 live');
	for (const seat of [3, 4]) {
		await lives
			.getByTestId('explosion-lives')
			.locator('li')
			.nth(seat - 2)
			.locator('[data-part="control"]')
			.tap();
	}
	// Leaving the Demon out is a note, never a lock.
	await expect(note).toHaveText('2 of 3 live; the Demon is not among them');
	await lives
		.getByTestId('explosion-lives')
		.locator('li')
		.nth(0)
		.locator('[data-part="control"]')
		.tap();
	await expect(note).toHaveText('3 of 3 live');
	await lives.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const pointed = page.getByRole('dialog', { name: 'Who was pointed at most?' });
	await pointed.getByText('Seat 3', { exact: true }).tap();
	await expect(pointed).toBeHidden();
	// The board under the two-alive game end prompt: Seat 2 (the Imp) and Seat 4 live.
	for (const seat of [1, 3, 5, 6])
		await expect(boardSeat(page, `Seat ${seat}`)).toHaveAttribute('data-dead', 'true');
	for (const seat of [2, 4])
		await expect(boardSeat(page, `Seat ${seat}`)).not.toHaveAttribute('data-dead');
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
	await startExecution(page);
	await endTheDay(page);
	// Night 2: seat 2 dies.
	await markDead(page, 2, 'The Demon');
	await endNight();
	await startExecution(page);
	await endTheDay(page);
	// Night 3: seat 2 comes back (the Professor, say).
	const sheet = await openSeat(page, 2);
	await sheet.getByRole('combobox', { name: /^Status/ }).tap();
	const status = page.getByRole('listbox');
	await status.getByRole('option', { name: 'Alive', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: /back to life\?$/ })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await closeSeat(page);
	await endNight();
	// Announcements must include people being revived (Trevor, 2026-10-20: L9).
	const announcements = (await paneDay(page)).getByTestId('announcements');
	await expect(announcements.getByTestId('revived')).toContainText(
		'The player in seat 2 is alive.'
	);
	await expect(announcements).toContainText('Nobody died in the night.');
});

test('holding the day timer or a new day resets it to the time per living player', async ({
	page
}) => {
	await startGame(page);
	const timer = await boardTimer(page);
	const clock = timer.getByRole('timer');
	await expect(clock).toHaveText('4:00');
	// Changed by hand: that lasts for this day only.
	await timer.getByRole('button', { name: '30 seconds less' }).tap();
	await expect(clock).toHaveText('3:30');
	// Holding the clock resets it (Trevor, 2026-10-19); the hold is not also a tap.
	const mode = timer.getByTestId('timer-mode');
	const caption = await mode.textContent();
	await clock.hover();
	await page.mouse.down();
	await page.waitForTimeout(800);
	await page.mouse.up();
	await expect(clock).toHaveText('4:00');
	await expect(mode).toHaveText(caption ?? '');
	await timer.getByRole('button', { name: '30 seconds less' }).tap();
	await expect(clock).toHaveText('3:30');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('timer-sheet')).toBeHidden();
	// Start game, then End night: Day 1, and the timer starts again at 8 players' time (Trevor,
	// 2026-10-19).
	await toDayOne(page);
	const dayTimer = await boardTimer(page);
	await expect(dayTimer.getByRole('timer')).toHaveText('4:00');
	await expect(dayTimer.getByRole('button', { name: 'Start timer' })).toBeEnabled();
	await page.keyboard.press('Escape');
	// Nobody dies on the first night as a rule, so Day 1 doesn't say "Nobody died" (Trevor,
	// 2026-11-04); that announcement starts on Day 2 (the revival test).
	const day = await paneDay(page);
	await expect(day.getByTestId('announcements')).toHaveText('None');
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
	await startExecution(page);
	await pickExecuted(page, 'Seat 3');
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
	await expect(walkThrough(page)).toHaveCount(0);
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

test('the corner and Resume agree on the night or day', async ({ page }) => {
	test.setTimeout(90_000);
	// Trevor (2026-10-24): Resume said Day 4 where the day view said Day 3.
	const path = await startGame(page);
	await chooseCharacter(page, 1, 'Imp');
	const phase = page.getByTestId('board-phase');
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	const endNight = async () => {
		await bank.getByRole('button', { name: 'End night', exact: true }).tap();
		await page
			.getByRole('alertdialog', { name: 'End the night?' })
			.getByRole('button', { name: 'Confirm' })
			.tap();
		await closeDay(page);
	};
	const resumed = async (text: string) => {
		await page.goto('/join');
		await expect(
			page.getByRole('link', { name: new RegExp(`Trouble Brewing.*${text} ·`) })
		).toBeVisible();
		await page.goto(path);
		await expect(page.getByTestId('seat')).toHaveCount(8);
	};

	await tapStartGame(page, bank.getByRole('button', { name: 'Start game', exact: true }));
	await expect(phase).toHaveText('Night 1');
	await endNight();
	await expect(phase).toHaveText('Day 1');
	await startExecution(page);
	await endTheDay(page);
	// Tonight follows Day 1: Night 2 on the board and in Resume.
	await expect(phase).toHaveText('Night 2');
	await resumed('Night 2');
	await expect(phase).toHaveText('Night 2');
	await endNight();
	await expect(phase).toHaveText('Day 2');
	await resumed('Day 2');
	await expect(phase).toHaveText('Day 2');
});

test('a game that ends at an Execution ends on that day', async ({ page }) => {
	test.setTimeout(90_000);
	await startGame(page);
	await chooseCharacter(page, 3, 'Imp');
	const phase = page.getByTestId('board-phase');
	// Start game, then End night: Day 1's Execution ticks Dusk, then End game: the game ended on Day 1 (Trevor, 2026-10-24).
	await startExecution(page);
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

test('a death marked by day on the Vizier is offered with a caution', async ({ page }) => {
	test.setTimeout(90_000);
	// https://wiki.bloodontheclocktower.com/Vizier: the Vizier cannot die during the day.
	await startGame(page);
	const sheet = await openSeat(page, 3);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 3' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Vizier', exact: true }).tap();
	await closeSeat(page);
	// Night 1 has no caution: the Vizier can die at night.
	let status = await openStatus(page, 3);
	await expect(status.getByTestId('cause-flag')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(status).toBeHidden();
	await closeSeat(page);
	// Start game, then End night: Day 1.
	await toDayOne(page);
	status = await openStatus(page, 3);
	// The list marks the cause; once it is set, the row's warning says why.
	await expect(
		status.getByRole('option', { name: 'Executed' }).getByTestId('cause-flag')
	).toHaveCount(0);
	await expect(
		status.getByRole('option', { name: 'The Demon' }).getByTestId('cause-flag')
	).toHaveCount(1);
	await status.getByRole('option', { name: 'The Demon' }).tap();
	await seatSheet(page).getByRole('button', { name: 'Why The Demon is marked' }).tap();
	const why = page.getByRole('dialog', { name: 'The Demon' });
	await expect(why).toContainText(/Seat 3 can't die during the day\s*\(\s*Vizier\s*\)/);
});

// https://wiki.bloodontheclocktower.com/Puzzlemaster: marking the guess used asks whom they
// guessed, then says what to tell them: the Demon for the player its Drunk is on, anyone but the
// Demon otherwise. Either way the Puzzlemaster gets Guess Used (M10b).
test('the Puzzlemaster’s guess asks who was guessed and says what to tell them', async ({
	page
}) => {
	await startGame(page);
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Puzzlemaster', exact: true }).tap();
	await closeSeat(page);
	await chooseCharacter(page, 2, 'Empath');
	await chooseCharacter(page, 3, 'Imp');
	await putReminder(page, 'Drunk', 2);

	const day = await openDay(page);
	await day
		.locator('li[data-character="puzzlemaster"]')
		.getByRole('button', { name: /^Used: Puzzlemaster/ })
		.tap();
	const chooser = page.getByRole('dialog', { name: /^Who did Puzzlemaster .* guess\?$/ });
	await chooser.getByRole('button', { name: /Seat 2$/ }).tap();
	const confirm = page.getByRole('alertdialog', { name: /^Mark Puzzlemaster .* as used\?$/ });
	const answer = confirm.getByTestId('day-use-answer');
	await expect(answer).toHaveAttribute('data-kind', 'right');
	await expect(answer).toContainText(/Right, so the Demon:\s*Imp\s+Seat 3/);
	// A player without the Puzzlemaster's Drunk is a wrong guess.
	await confirm.getByTestId('day-use-on').tap();
	await chooser.getByRole('button', { name: /Seat 4$/ }).tap();
	await expect(answer).toHaveAttribute('data-kind', 'wrong');
	await expect(answer).toContainText(/Wrong, so anyone but the Demon:\s*Imp\s+Seat 3/);
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await closeDay(page);
	await expect(
		page.locator('[data-testid="seat"][aria-label^="Seat 1: no name, Puzzlemaster"]')
	).toHaveAttribute('aria-label', /1 reminder/);
});

// M15b, https://wiki.bloodontheclocktower.com/Buddhist: for the first two minutes of each day
// the veterans may not talk. With the Buddhist in play the day timer counts that down on its
// top edge, in place of its mode's name, so nothing moves.
test('with the Buddhist in play the day timer counts down the veterans’ quiet', async ({
	page
}) => {
	await page.clock.install();
	await startGame(page);
	await paneButton(page, 'Seats', 'Add Fabled or Loric');
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Buddhist', exact: true })
		.tap();
	await expect(
		page.getByRole('list', { name: 'Fabled and Loric' }).getByRole('button', { name: 'Buddhist' })
	).toBeVisible();
	await openDay(page);
	const timer = await boardTimer(page);
	const quiet = timer.getByTestId('timer-quiet');
	await expect(quiet).toHaveText('Veterans quiet 2:00');
	await expect(timer.getByTestId('timer-mode')).toHaveCount(0);
	const height = (await timer.boundingBox())!.height;
	await timer.getByRole('button', { name: 'Start timer' }).tap();
	await page.clock.runFor(30_000);
	await expect(quiet).toHaveText('Veterans quiet 1:30');
	await expect(timer).toHaveAttribute('aria-label', /Veterans may not talk for 1:30 more/);
	await page.clock.runFor(91_000);
	// Over: the mode's name is back, in the same place.
	await expect(quiet).toHaveCount(0);
	await expect(timer.getByTestId('timer-mode')).toHaveText('Timer');
	expect((await timer.boundingBox())!.height).toBeCloseTo(height, 0);
});

/** Gives seat `number` a character from off the script, answering its alignment if asked. */
async function chooseOffScript(page: Page, number: number, name: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: new RegExp(`^${name}(,|$)`) }).tap();
	const ask = page.getByRole('dialog', { name: 'Alignment' });
	if (await ask.isVisible().catch(() => false))
		await ask.getByRole('button', { name: 'Good' }).tap();
	await closeSeat(page);
}

test('Execution asks whether only evil voted while the Legion works; yes fails it and the day goes on (M9d)', async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Legion: an execution fails when only evil players
	// voted. Votes aren't recorded, so the Storyteller answers.
	await startGame(page);
	await chooseCharacter(page, 1, 'Chef');
	await chooseOffScript(page, 2, 'Legion');
	await startExecution(page);
	// While the Legion works, picking a player opens the sheet (executionAsks).
	const ask = await pickExecuted(page, 'Seat 1');
	const onlyEvil = ask.getByRole('checkbox', {
		name: 'Only evil voted, for the Legion',
		includeHidden: true
	});
	await expect(onlyEvil).toBeEnabled();
	await ask.getByTestId('outcome-fails').locator('[data-part="control"]').tap();
	await expect(onlyEvil).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// The execution failed: Seat 1 lives, and the day stays open for another nomination.
	await expect(ask).toBeHidden();
	await expect(walkThrough(page)).toHaveCount(0);
	await expect(boardSeat(page, 'Seat 1')).not.toHaveAccessibleName(/dead/);
});

test('a player nominates the Storyteller, who is executed, and good wins with the Atheist (M15l)', async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Atheist: any living player may nominate the
	// Storyteller; executed, good wins if the Atheist is in play.
	await startGame(page);
	await chooseCharacter(page, 1, 'Chef');
	await chooseOffScript(page, 2, 'Atheist');
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller' })
		.tap();
	await settings.getByText('Track nominations', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
	// Start game, then End night: Day 1's nomination.
	await toDayOne(page);
	await page.getByTestId('seat').nth(0).getByTestId('nomination-marks').tap();
	await page
		.getByRole('dialog', { name: 'Who did Seat 1 nominate?' })
		.getByTestId('choose-storyteller')
		.tap();
	await startExecution(page);
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: 'Storyteller', exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	const end = prompt.locator('[data-rule="storyteller-executed"]');
	await expect(end).toContainText('The Storyteller was executed, and the');
	await expect(end.locator('[data-character-id="atheist"]')).toBeVisible();
	await expect(prompt.getByTestId('game-end-prompt')).toContainText('Good wins');
});

test("Execution records the Judge's forced pass and marks the ruling used (M9d)", async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Judge: once per game, on another player's
	// nomination, the Judge may force the execution to pass; "No Ability" then marks it used.
	await startGame(page);
	await chooseCharacter(page, 1, 'Chef');
	await chooseCharacter(page, 2, 'Empath');
	await chooseOffScript(page, 3, 'Judge');
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller' })
		.tap();
	await settings.getByText('Track nominations', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
	// Start game, then End night: Day 1's nomination.
	await toDayOne(page);
	await page.getByTestId('seat').nth(0).getByTestId('nomination-marks').tap();
	await page
		.getByRole('dialog', { name: 'Who did Seat 1 nominate?' })
		.getByText('Seat 2', { exact: true })
		.tap();
	await startExecution(page);
	// While the Judge's ruling is unused, picking a player opens the sheet (executionAsks).
	const ask = await pickExecuted(page, 'Seat 2');
	const ruling = ask.getByRole('combobox', { name: 'Ruling by the Judge' });
	await expect(ruling).toBeEnabled();
	await ruling.tap();
	await page.getByRole('option', { name: 'Forced to pass' }).tap();
	await expect(ruling).toContainText('Forced to pass');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(walkThrough(page)).toBeVisible();
	await expect(boardSeat(page, 'Seat 2')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 3')).toHaveAccessibleName(/1 reminder/);
});

test("the Cult Leader's cult vote asks whether every good player joined, then offers the win (M9d)", async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Cult_Leader: when every living good player joins
	// the cult, the Cult Leader's team wins. Offered by End game, never automatic.
	await startGame(page);
	await chooseOffScript(page, 1, 'Cult Leader');
	await chooseCharacter(page, 2, 'Chef');
	await chooseCharacter(page, 3, 'Imp');
	const day = await openDay(page);
	await day
		.locator('li[data-character="cultleader"]')
		.getByRole('button', { name: /^Used: Cult Leader/ })
		.tap();
	// No player to pick: the confirm opens straight away, with the vote off.
	const confirm = page.getByRole('alertdialog', { name: /^Mark Cult Leader .* as used\?$/ });
	const joined = confirm.getByRole('checkbox', {
		name: 'Every living good player joined',
		includeHidden: true
	});
	await expect(joined).not.toBeChecked();
	await confirm.getByTestId('day-use').locator('[data-part="control"]').tap();
	await expect(joined).toBeChecked();
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await expect(end.locator('li[data-rule="cult-joined"]')).toBeVisible();
});

// https://wiki.bloodontheclocktower.com/Ferryman: the Storyteller declares the final day, and
// every dead player who used their vote token gets it back (Trevor, 2026-11-14: a Final day
// button on the Ferryman's row, the app never guesses which day it is).
test("the Ferryman's Final day gives every used vote token back", async ({ page }) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste
		.getByLabel('Script JSON')
		.fill(
			JSON.stringify([
				{ id: '_meta', name: 'Ferry Crossing' },
				'chef',
				'empath',
				'monk',
				'soldier',
				'imp',
				'ferryman'
			])
		);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await page.goto('/new');
	await pickScript(page, 'Ferry Crossing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	await toBoard(page);
	for (const n of [2, 3]) {
		const status = await openStatus(page, n);
		await status.getByRole('option').nth(1).tap();
		await expect(status).toBeHidden();
		await closeSeat(page);
	}
	const day = await openDay(page);
	const finalDay = day.getByTestId('final-day');
	// Nobody has used a vote token yet: nothing to give back.
	await expect(finalDay).toBeDisabled();
	await closeDay(page);
	for (const n of [2, 3]) await toggleGhostVote(page, n);
	await openDay(page);
	await expect(page.getByTestId('ghost-votes')).toHaveText('0');
	await finalDay.tap();
	const confirm = page.getByRole('alertdialog', { name: 'Final day' });
	await expect(confirm.getByTestId('player-badge')).toHaveText(['Seat 2', 'Seat 3']);
	await expect(confirm).toContainText('used their vote token.');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('ghost-votes')).toHaveText('2');
	await expect(finalDay).toBeDisabled();
});
