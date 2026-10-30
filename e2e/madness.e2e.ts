import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';

/**
 * Breaking madness (L84, https://wiki.bloodontheclocktower.com/Madness): the day view's
 * madness row offers what the Storyteller may do to a mad player who breaks it. The Cerenovus's
 * mad player might be executed (https://wiki.bloodontheclocktower.com/Cerenovus); for the
 * Harpy, the 1st player, the 2nd or both might die (https://wiki.bloodontheclocktower.com/Harpy).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const sheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function choose(page: Page, number: number, name: string, offScript = false) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await sheet(page).getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
}

const boardSeat = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

async function openDay(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^Day( \d+)?$/ });
	await expect(day).toBeVisible();
	return day;
}

test("the Cerenovus's mad player who breaks madness is offered for execution", async ({ page }) => {
	// Several characters and reminders to place first.
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Cerenovus');
	await choose(page, 2, 'Clockmaker');
	await putReminder(page, 'Mad', 2);
	const day = await openDay(page);
	const row = day.locator('li[data-character="cerenovus"]');
	await row.getByTestId('broke-madness').tap();
	// The day's Execution asks, with the mad player chosen.
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 2');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await expect(boardSeat(page, 'Seat 2')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 1')).not.toHaveAccessibleName(/dead/);
});

test("the Harpy's mad player who breaks madness asks who of the two dies", async ({ page }) => {
	// Several characters and reminders to place first.
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Harpy', true);
	await choose(page, 2, 'Clockmaker');
	await choose(page, 3, 'Dreamer');
	await putReminder(page, 'Mad', 2);
	await putReminder(page, '2nd', 3);
	const day = await openDay(page);
	await day.locator('li[data-character="harpy"]').getByTestId('broke-madness').tap();
	const ask = page.getByRole('alertdialog', { name: 'Who dies for breaking madness?' });
	const deaths = ask.getByTestId('madness-deaths');
	await expect(deaths).toContainText(/Seat 2\s*Seat 3/);
	// Nobody is chosen to start with; the Storyteller may kill one or both.
	await expect(ask.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
	await deaths
		.getByRole('listitem')
		.filter({ hasText: 'Seat 3' })
		.locator('[data-part="control"]')
		.tap();
	await expect(ask.getByRole('checkbox', { name: 'Dies: Seat 3' })).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(boardSeat(page, 'Seat 3')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 2')).not.toHaveAccessibleName(/dead/);
});
