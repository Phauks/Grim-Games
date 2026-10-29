import { expect, type Page } from '@playwright/test';

const BASE_THREE = ['Trouble Brewing', 'Bad Moon Rising', 'Sects & Violets'];

/**
 * Chooses New game's script: a tap on one of the base three, or any other script found by
 * typing its name in the script search, which Custom opens (Trevor, 2026-10-19).
 */
export async function pickScript(page: Page, name: string): Promise<void> {
	if (BASE_THREE.includes(name)) {
		await page.getByRole('radiogroup', { name: 'Script' }).getByText(name, { exact: true }).tap();
		return;
	}
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Custom', { exact: true }).tap();
	const field = page.getByRole('combobox', { name: 'Find a script' });
	await field.tap();
	await field.fill(name);
	await page.getByRole('option').filter({ hasText: name }).first().tap();
	await expect(field).toHaveValue(name);
}

/**
 * Names the Storyteller of the game on the board, on its Characters screen, where the name
 * is typed (Trevor, 2026-10-19), then comes back to the board.
 */
export async function nameStoryteller(page: Page, name: string): Promise<void> {
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/setup`);
	const field = page.getByRole('textbox', { name: 'Storyteller' });
	await field.fill(name);
	await field.press('Enter');
	await page.goto(board);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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

/** Game info: from ⋯ where the board lists it, otherwise from the corner. */
export async function openGameInfo(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	return page.getByRole('dialog', { name: 'Game info', exact: true });
}
