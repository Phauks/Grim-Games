import { expect, test, type Page } from '@playwright/test';
import { chooseExecution, startExecution } from './execution.ts';
import { toBoard } from './new-game.ts';
import { walkName, walkNext, walkThrough } from './night-step.ts';
import { openPane, paneIsSheet, storytellerPane } from './players.ts';

// The grim as the home screen (Trevor, 2026-11-16: "make the grim the home screen"): the Day
// and the Night are tabs of the Storyteller's pane, with Notes and Players. Beside the board
// it always shows, so the board never changes size; on a phone one button opens it as a sheet
// named Game.

async function newGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('cover-button')).toBeVisible();
}

const endNight = (page: Page) =>
	page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true });

test('the Day, the Night, Notes and Players are one pane: beside the board, or Game on a phone', async ({
	page
}) => {
	await newGame(page);
	const sheet = await paneIsSheet(page);
	// No Day button: the Day is the pane's.
	await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveCount(0);
	if (sheet) {
		await expect(storytellerPane(page)).toBeHidden();
		await expect(page.getByTestId('game-pane-button')).toBeVisible();
	} else {
		// Always shown, so there is no button to open it.
		await expect(storytellerPane(page)).toBeVisible();
		await expect(page.getByTestId('game-pane-button')).toHaveCount(0);
	}
	const pane = await openPane(page);
	for (const tab of ['Day', 'Night', 'Notes', 'Players'])
		await expect(pane.getByRole('tab', { name: new RegExp(`^${tab}`) })).toBeVisible();
	// Before the first night, the Day tab is open, with no second timer (the board's is the one).
	await expect(pane.getByTestId('pane-day')).toBeVisible();
	await expect(pane.getByTestId('day-timer')).toHaveCount(0);

	// The Night tab lists the nights' steps, each night closing from its header.
	await pane.getByRole('tab', { name: /^Night/ }).tap();
	const night = pane.getByTestId('pane-night');
	await expect(night.getByRole('button', { name: /^First night/ })).toBeVisible();
	await expect(night.getByRole('button', { name: /^Other nights/ })).toBeVisible();
});

test("tonight's step is the pane's Night tab, with the strip's Next", async ({ page }) => {
	await newGame(page);
	await startExecution(page);
	await chooseExecution(page);
	await expect(endNight(page)).toBeEnabled();
	await expect(walkThrough(page)).toBeVisible();
	await expect(walkName(page)).toHaveText('Dusk');
	await walkNext(page).tap();
	await expect(walkName(page)).not.toHaveText('Dusk');

	if (!(await paneIsSheet(page))) {
		// Beside the board there is no strip: the pane has the step, its count by the night.
		await expect(page.getByTestId('night-strip')).toHaveCount(0);
		const step = storytellerPane(page).getByRole('region', { name: 'Other nights' });
		await expect(step.getByTestId('step-count')).toHaveText(/^2 of \d+$/);
		await step.getByRole('button', { name: 'Previous step', exact: true }).tap();
		await expect(walkName(page)).toHaveText('Dusk');
	}
});

test('starting the timer at night asks to start the day', async ({ page }) => {
	await newGame(page);
	await startExecution(page);
	await chooseExecution(page);
	await expect(endNight(page)).toBeEnabled();

	const board = page.locator('.board-timer').getByTestId('day-timer');
	await board.getByRole('button', { name: /open its controls$/ }).tap();
	await page
		.getByRole('dialog', { name: 'Day timer' })
		.getByRole('button', { name: 'Start timer' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the day?' });
	await expect(ask).toBeVisible();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	// The night is over: the bank's button is Execution again.
	await expect(endNight(page)).toHaveCount(0);
});
