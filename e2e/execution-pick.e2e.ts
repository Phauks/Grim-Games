import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';

// The day's Execution on the board (Trevor, 2026-11-06: "make the storyteller pick the player
// who dies on the screen, then confirm it", option B): Execution asks for a seat, a tap picks
// it, and the bar over the bank confirms. With a save on the script, the sheet opens instead.

const seatSheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');
const boardSeat = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

// A new game, a character and Start game before each.
test.describe.configure({ timeout: 90_000 });

/** A started game: one Imp, so the bank offers Start game, and the first night under way. */
async function startedGame(page: Page, script = 'Trouble Brewing', demon = 'Imp') {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText(script, { exact: true }).tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await pickNumber(page, 'Players', 7);
	await toBoard(page);
	await boardSeat(page, 'Seat 1:').tap();
	await seatSheet(page).getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: new RegExp(`^${demon}(, Recommended)?$`) })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true })
		.tap();
	const startAsk = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(startAsk)).toBeVisible();
	if (await startAsk.isVisible())
		await startAsk.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

/** Execution from the day view: the day view closes and the board asks for a seat. */
async function startExecution(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: 'Day', exact: true });
	await day.getByRole('button', { name: 'Execution', exact: true }).tap();
	await expect(day).toBeHidden();
	const bar = page.getByTestId('execution-pick');
	await expect(bar.getByTestId('execution-pick-question')).toHaveText('Tap the executed player');
	return bar;
}

test('the executed player is tapped on the board and confirmed there', async ({ page }) => {
	await startedGame(page);
	const bar = await startExecution(page);
	const confirm = bar.getByRole('button', { name: 'Confirm', exact: true });
	await expect(confirm).toBeDisabled();
	const question = bar.getByTestId('execution-pick-question');
	const actions = await confirm.boundingBox();

	// A tap picks a seat without opening it; another tap changes the pick.
	await boardSeat(page, 'Seat 3:').tap();
	await expect(seatSheet(page)).toBeHidden();
	await expect(question).toContainText('Execute');
	await expect(question).toContainText('Seat 3');
	await expect(boardSeat(page, 'Seat 3:')).toHaveAttribute('data-drop', 'true');
	await boardSeat(page, 'Seat 4:').tap();
	await expect(question).toContainText('Seat 4');
	await expect(boardSeat(page, 'Seat 3:')).not.toHaveAttribute('data-drop');
	// The question never moves Confirm (no reflow).
	expect(await confirm.boundingBox()).toEqual(actions);

	await confirm.tap();
	await expect(bar).toBeHidden();
	await expect(boardSeat(page, 'Seat 4:')).toHaveAttribute('data-dead', 'true');
	await expect(
		page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: 'Execution', exact: true })
	).toHaveCount(0);
});

test('No execution and Cancel are on the bar', async ({ page }) => {
	await startedGame(page);
	let bar = await startExecution(page);
	await bar.getByRole('button', { name: 'No execution', exact: true }).tap();
	await expect(bar.getByTestId('execution-pick-question')).toHaveText('No execution today?');
	await bar.getByRole('button', { name: 'Cancel', exact: true }).tap();
	await expect(bar).toBeHidden();
	// Cancelled, a seat tap opens the seat again.
	await boardSeat(page, 'Seat 2:').tap();
	await expect(seatSheet(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();

	bar = await startExecution(page);
	await bar.getByRole('button', { name: 'No execution', exact: true }).tap();
	await bar.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(bar).toBeHidden();
	await expect(page.locator('[data-testid="seat"][data-dead]')).toHaveCount(0);
});

test('with a save on the script, the picked player opens the Execution sheet', async ({ page }) => {
	// Bad Moon Rising has the Sailor, Tea Lady, Pacifist and Devil's Advocate: Saved by asks.
	await startedGame(page, 'Bad Moon Rising', 'Po');
	const bar = await startExecution(page);
	await boardSeat(page, 'Seat 5:').tap();
	await expect(bar).toBeHidden();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 5');
	await expect(ask.getByRole('combobox', { name: 'Saved by' })).toBeVisible();
});
