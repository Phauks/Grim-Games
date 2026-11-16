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

export type PaneTab = 'Day' | 'Night' | 'Notes' | 'Players';

/** Opens the pane at a tab: its button on a phone; beside the board it always shows. */
export async function openPane(page: Page, tab?: PaneTab) {
	const pane = storytellerPane(page);
	if (!(await pane.isVisible())) await page.getByTestId('game-pane-button').tap();
	await expect(pane).toBeVisible();
	if (tab) {
		const trigger = pane.getByRole('tab', { name: new RegExp(`^${tab}`) });
		await trigger.tap();
		await expect(trigger).toHaveAttribute('aria-selected', 'true');
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
	return !(await page.getByRole('complementary', { name: 'Game', exact: true }).isVisible());
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
