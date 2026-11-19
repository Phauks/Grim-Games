import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The Storyteller's pane, "Game": the Day, the Night, Notes and Players (plan M86; the grim as
 * the home screen, Trevor 2026-11-16). Always beside the board where the screen has room (under
 * it on an upright tablet), over the screen on a phone, opened from its button.
 */
export function storytellerPane(page: Page): Locator {
	const name = 'Game';
	return page
		.getByRole('complementary', { name, exact: true })
		.or(page.getByRole('dialog', { name, exact: true }));
}

/** A tap on a touch screen, a click where the page has only a mouse. */
async function press(target: Locator) {
	if (await target.page().evaluate(() => navigator.maxTouchPoints > 0)) await target.tap();
	else await target.click();
}

/** The pane's views, each under its subject (Trevor, 2026-11-18: nav with a sub-nav). */
const SUBJECTS = {
	Day: 'Game',
	Night: 'Game',
	Bluffs: 'Game',
	Players: 'Players',
	Notes: 'Players',
	Seats: 'More',
	Sounds: 'More',
	Theme: 'More',
	History: 'More',
	Session: 'More'
} as const;
export type PaneTab = keyof typeof SUBJECTS;

/**
 * Taps a tab in one of the pane's rails, unless it is chosen already; from the rail's own
 * "More tabs" when the pane is too narrow for it.
 */
async function choose(pane: Locator, rail: string, name: string) {
	const list = pane.getByRole('tablist', { name: rail, exact: true });
	const trigger = list.getByRole('tab', { name: new RegExp(`^${name}`) });
	await expect(list).toBeVisible();
	if (!(await trigger.count())) {
		await press(list.locator('..').getByRole('button', { name: 'More tabs' }));
		await press(
			pane.page().getByRole('dialog', { name: 'More tabs' }).getByRole('button', { name })
		);
	} else if ((await trigger.getAttribute('aria-selected')) !== 'true') await press(trigger);
	await expect(trigger).toHaveAttribute('aria-selected', 'true');
}

/**
 * Opens the pane at a view: its subject in the top rail, then the view in the subject's own
 * rail. Its button on a phone; beside the board it always shows.
 */
export async function openPane(page: Page, tab?: PaneTab) {
	const pane = storytellerPane(page);
	const button = page.getByTestId('game-pane-button');
	// Beside the board the pane shows, on a phone its button: whichever, once the board is up.
	await expect(pane.or(button).first()).toBeVisible();
	if (!(await pane.isVisible())) await press(button);
	await expect(pane).toBeVisible();
	if (tab) {
		const subject = SUBJECTS[tab];
		await choose(pane, 'Game', subject);
		await choose(pane, `${subject} views`, tab);
	}
	return pane;
}

/**
 * Back to the board: a phone's sheet closes by its Close, as a phone user does (Escape runs
 * zag's own close, whose flushSync can crash Svelte 5.57 in a sheet over Grim view's dialog);
 * beside the board the pane stays.
 */
export async function closePane(page: Page) {
	const sheet = page.getByRole('dialog', { name: 'Game', exact: true });
	if (!(await sheet.isVisible())) return;
	// Already on its way out (closed a moment ago): only wait for it to go.
	if ((await sheet.getAttribute('data-state')) !== 'closed')
		await press(sheet.getByRole('button', { name: 'Close', exact: true }));
	await expect(sheet).toBeHidden();
}

/** The pane's Day tab (Trevor, 2026-11-16: the Day sheet's place). */
export async function paneDay(page: Page): Promise<Locator> {
	const pane = await openPane(page, 'Day');
	const day = pane.getByTestId('pane-day');
	await expect(day).toBeVisible();
	return day;
}

/** Whether the pane is a phone's sheet over the board, rather than beside it. */
export async function paneIsSheet(page: Page): Promise<boolean> {
	const beside = page.getByRole('complementary', { name: 'Game', exact: true });
	const button = page.getByTestId('game-pane-button');
	await expect(beside.or(button).first()).toBeVisible();
	return !(await beside.isVisible());
}

/**
 * Opens the Storyteller's Players, the pane's second tab (plan M86; Trevor, 2026-10-29:
 * Messages folded into Players).
 */
export async function openPlayers(page: Page) {
	return openPane(page, 'Players');
}

/** A player's row in Players: its header opens their messages and notes beneath it. */
export function playerRow(players: Locator, name: string) {
	const row = players.getByTestId('room-player').filter({ hasText: name });
	return { row, toggle: row.getByRole('button').first() };
}

/**
 * Opens Players at one player: their row opened, so their messages and notes show beneath it
 * (Trevor, 2026-11-18).
 */
export async function openPlayerSheet(page: Page, name: string) {
	const players = await openPlayers(page);
	const { row, toggle } = playerRow(players, name);
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	const sheet = row.getByTestId('room-player-sheet');
	await expect(sheet).toBeVisible();
	return sheet;
}

/**
 * The day timer's full controls: the toolbar's timer (Trevor, 2026-11-18), the only one since
 * the Day moved into the pane (2026-11-16), opened as its sheet. A phone's pane closes first.
 */
export async function boardTimer(page: Page): Promise<Locator> {
	const sheet = page.getByTestId('timer-sheet');
	if (!(await sheet.isVisible())) {
		await closePane(page);
		await page
			.locator('.toolbar-timer')
			.getByTestId('day-timer')
			.getByRole('button', { name: /open its controls$/ })
			.tap();
	}
	await expect(sheet).toBeVisible();
	return sheet.getByTestId('day-timer');
}

/**
 * The timer with Back to town and Start: the toolbar's own where there is room, or on a phone,
 * where the toolbar shows the clock only (Trevor, 2026-11-18), its sheet's.
 */
export async function timerControls(page: Page): Promise<Locator> {
	const bar = page.locator('.toolbar-timer').getByTestId('day-timer');
	await expect(bar).toBeVisible();
	if (await bar.getByRole('button', { name: 'Back to town' }).isVisible()) return bar;
	return boardTimer(page);
}

/** Closes the timer's sheet, if a phone opened it for its controls. */
export async function closeTimerSheet(page: Page) {
	const sheet = page.getByTestId('timer-sheet');
	if (!(await sheet.isVisible())) return;
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

/**
 * Closes the pane over a step: on a phone the step closes with its sheet; beside the board it
 * stays, the pane's Night tab.
 */
export async function closeStep(page: Page, step: Locator) {
	await closePane(page);
	if (await paneIsSheet(page)) await expect(step).toBeHidden();
}

/**
 * Taps a button in one of the pane's views, where the board's ⋯ items went (Trevor,
 * 2026-11-18). Seats' and Session's buttons all close a phone's sheet.
 */
export async function paneButton(page: Page, view: PaneTab, name: string | RegExp) {
	const sheet = await paneIsSheet(page);
	const pane = await openPane(page, view);
	await press(pane.getByRole('button', { name, exact: typeof name === 'string' }));
	// Each of these closes a phone's sheet first; the board takes taps once it has gone.
	if (sheet) {
		await expect(page.getByRole('dialog', { name: 'Game', exact: true })).toBeHidden();
		await expect(
			page.locator('[data-scope="dialog"][data-part="backdrop"][data-state="closed"]')
		).toHaveCount(0);
	}
}
