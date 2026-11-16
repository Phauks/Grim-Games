import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The Storyteller's pane of Game notes and Players (plan M86): beside the board where the
 * screen has room (under it on an upright tablet), over the screen on a phone.
 */
export function storytellerPane(page: Page): Locator {
	const name = 'Game notes and Players';
	return page
		.getByRole('complementary', { name, exact: true })
		.or(page.getByRole('dialog', { name, exact: true }));
}

/** Opens the pane from its button beside the grim cover, unless it shows already. */
export async function openPane(page: Page, tab?: 'Game notes' | 'Players') {
	const pane = storytellerPane(page);
	if (!(await pane.isVisible())) await page.getByTestId('game-notes-button').tap();
	await expect(pane).toBeVisible();
	if (tab) {
		const trigger = pane.getByRole('tab', { name: new RegExp(`^${tab}`) });
		await trigger.tap();
		await expect(trigger).toHaveAttribute('aria-selected', 'true');
	}
	return pane;
}

/** Closes the pane: ✕ over a phone's screen, its own button beside the board. */
export async function closePane(page: Page) {
	const pane = storytellerPane(page);
	const sheet = page.getByRole('dialog', { name: 'Game notes and Players', exact: true });
	if (await sheet.isVisible()) await page.keyboard.press('Escape');
	else if (await pane.isVisible()) await page.getByTestId('game-notes-button').tap();
	await expect(pane).toBeHidden();
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
