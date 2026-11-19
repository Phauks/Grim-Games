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

/** The pane's views, each under its subject (Trevor, 2026-11-18: nav with a sub-nav). */
const SUBJECTS = {
	Day: 'Game',
	Night: 'Game',
	Bluffs: 'Game',
	Players: 'Players',
	Notes: 'Players',
	Seats: 'More',
	Sounds: 'More',
	History: 'More',
	Session: 'More'
} as const;
export type PaneTab = keyof typeof SUBJECTS;

/** Taps a tab in one of the pane's rails, unless it is chosen already. */
async function choose(pane: Locator, rail: string, name: string) {
	const trigger = pane
		.getByRole('tablist', { name: rail, exact: true })
		.getByRole('tab', { name: new RegExp(`^${name}`) });
	if ((await trigger.getAttribute('aria-selected')) !== 'true') await trigger.tap();
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
	if (!(await pane.isVisible())) await button.tap();
	await expect(pane).toBeVisible();
	if (tab) {
		const subject = SUBJECTS[tab];
		await choose(pane, 'Game', subject);
		await choose(pane, `${subject} views`, tab);
	}
	return pane;
}

/** Back to the board: a phone's sheet closes; beside the board the pane stays. */
export async function closePane(page: Page) {
	const sheet = page.getByRole('dialog', { name: 'Game', exact: true });
	if (!(await sheet.isVisible())) return;
	await page.keyboard.press('Escape');
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

/**
 * Opens Players at one player: their line tapped, so their messages, notes and reported
 * picture show beside the list (below it in the pane) (Trevor, 2026-11-01).
 */
export async function openPlayerSheet(page: Page, name: string) {
	const players = await openPlayers(page);
	const row = players.getByTestId('room-player').filter({ hasText: name });
	await row.getByRole('button').tap();
	await expect(row.getByRole('button')).toHaveAttribute('aria-current', 'true');
	const sheet = players.getByTestId('room-player-sheet');
	await expect(sheet).toBeVisible();
	return sheet;
}

/**
 * The day timer's full controls: the board's timer, the only one since the Day moved into the
 * pane (Trevor, 2026-11-16), opened as its sheet. A phone's pane closes first.
 */
export async function boardTimer(page: Page): Promise<Locator> {
	const sheet = page.getByTestId('timer-sheet');
	if (!(await sheet.isVisible())) {
		await closePane(page);
		await page
			.locator('.board-timer')
			.getByTestId('day-timer')
			.getByRole('button', { name: /open its controls$/ })
			.tap();
	}
	await expect(sheet).toBeVisible();
	return sheet.getByTestId('day-timer');
}

/**
 * Closes the pane over a step: on a phone the step closes with its sheet; beside the board it
 * stays, the pane's Night tab.
 */
export async function closeStep(page: Page, step: Locator) {
	await closePane(page);
	if (await paneIsSheet(page)) await expect(step).toBeHidden();
}
