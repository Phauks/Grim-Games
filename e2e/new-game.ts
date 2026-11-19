import { expect, type Page } from '@playwright/test';
import { setPlayerName } from './player-name.ts';
import { openSettingsDialog } from './shell.ts';
import { paneButton } from './players.ts';

const BASE_THREE = ['Trouble Brewing', 'Bad Moon Rising', 'Sects & Violets'];

/**
 * Chooses New game's script: a tap on one of the base three, or any other script found by
 * typing its name in the Choose a script sheet, which Custom's field opens (Trevor,
 * 2026-11-06).
 */
export async function pickScript(page: Page, name: string): Promise<void> {
	if (BASE_THREE.includes(name)) {
		await chooseScriptKind(page, 'Official');
		await page.getByRole('radiogroup', { name: 'Script' }).getByText(name, { exact: true }).tap();
		return;
	}
	const field = await openCustomSheet(page);
	const sheet = page.getByTestId('script-sheet');
	await sheet.getByRole('searchbox', { name: 'Find a script' }).fill(name);
	await sheet.getByRole('button').filter({ hasText: name }).first().tap();
	await expect(sheet).toBeHidden();
	await expect(field).toHaveText(name);
}

/**
 * Official or Custom above the script (Trevor, 2026-11-15): only that kind's controls can be
 * tapped.
 */
export async function chooseScriptKind(page: Page, kind: 'Official' | 'Custom'): Promise<void> {
	const kinds = page.getByRole('radiogroup', { name: 'Official or custom' });
	await kinds.getByText(kind, { exact: true }).tap();
	await expect(kinds.getByRole('radio', { name: kind })).toBeChecked();
}

/** Chooses Custom and opens the Choose a script sheet from its field; returns the field. */
export async function openCustomSheet(page: Page) {
	await chooseScriptKind(page, 'Custom');
	const field = page.getByTestId('custom-script');
	await field.tap();
	await expect(page.getByTestId('script-sheet')).toBeVisible();
	return field;
}

/**
 * Names the Storyteller: the Profile's name, set from Settings over the board, which the board
 * then gives its game (Trevor, 2026-10-30: "All connected to profile name").
 */
export async function nameStoryteller(page: Page, name: string): Promise<void> {
	const settings = await openSettingsDialog(page);
	await settings.getByRole('button', { name: 'Profile', exact: true }).tap();
	await setPlayerName(page, name);
	await page.keyboard.press('Escape');
	await expect(settings).toBeHidden();
}

/**
 * After Start game: every start goes on to Character selection (Trevor, 2026-10-23; Game
 * settings opens there since 2026-10-29); this goes on from there to the board without a bag.
 */
export async function toBoard(page: Page): Promise<void> {
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	// A tap on touch screens: a click would leave the mouse over the board, pausing its toasts.
	const shortcut = page.getByTestId('setup-to-board');
	if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await shortcut.tap();
	else await shortcut.click();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
}

/**
 * Game info: from the corner, or from the pane's More, Session where the board hides the corner.
 * A spectator's comes from ⋯.
 */
export async function openGameInfo(page: Page) {
	const corner = page.getByTestId('mode-menu');
	// Once the board is up, so a corner still on its way isn't taken for a hidden one.
	await expect(page.getByTestId('cover-button')).toBeVisible();
	if (await corner.isVisible()) await corner.tap();
	else if (await page.getByRole('button', { name: 'More', exact: true }).isVisible()) {
		await page.getByRole('button', { name: 'More', exact: true }).tap();
		await page
			.getByRole('dialog', { name: 'Grimoire' })
			.getByRole('button', { name: 'Game info' })
			.tap();
	} else await paneButton(page, 'Session', 'Game info');
	return page.getByRole('dialog', { name: 'Game info', exact: true });
}

/**
 * Switches these special rules on from Character selection, where a game's rules are chosen
 * since 2026-10-29 (Trevor): the screen opens again on them as the sheet closes.
 */
export async function chooseRulesOnSetup(page: Page, ...names: string[]): Promise<void> {
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const button = page.getByTestId('setup-special-rules');
	await button.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	const list = dialog.getByTestId('special-rules');
	for (const name of names) {
		await list.getByText(name, { exact: true }).tap();
		await expect(list.getByRole('checkbox', { name, includeHidden: true })).toBeChecked();
	}
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await expect(button).toHaveText(`Special rules ${names.length}`);
}
