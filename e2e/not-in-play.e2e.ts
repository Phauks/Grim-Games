import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';
import { addSeat } from './seating.ts';

// Seats not in play yet (Trevor, 2026-10-31): a Traveller who arrives mid-game sits down at
// the table before the night they join at. The seat is greyed with a "Not in play" pill and
// counts for nothing until the next night starts, or the Storyteller puts it in play.

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 8);
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const daySheet = (page: Page) => page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
const seatSheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');
const endNight = (page: Page) =>
	page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true });

/** Ends the day with no execution, which starts tonight's night at Dusk. */
async function execution(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await daySheet(page).getByRole('button', { name: 'Execution' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'End the day?' });
	await confirm.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: 'No execution', exact: true }).tap();
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(daySheet(page)).toBeHidden();
	await expect(endNight(page)).toBeEnabled();
}

/** End night asks first, then starts the next day and opens its sheet; closed here. */
async function endTheNight(page: Page) {
	await endNight(page).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the night?' });
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ask).toBeHidden();
	await daySheet(page).getByRole('button', { name: 'Close' }).tap();
	await expect(daySheet(page)).toBeHidden();
}

async function aliveCount(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(page.getByTestId('alive-count')).toBeVisible();
	const text = await page.getByTestId('alive-count').textContent();
	await daySheet(page).getByRole('button', { name: 'Close' }).tap();
	await expect(daySheet(page)).toBeHidden();
	return text;
}

test('a seat added mid-game is not in play until the next night', async ({ page }) => {
	await startGame(page);
	await execution(page);
	await endTheNight(page);

	// Day 1: a Traveller arrives and sits down.
	await addSeat(page, 'Place between Seat 8 and Seat 1');
	const arrival = page.getByRole('button', { name: /^Seat 9:/ });
	await expect(arrival).toHaveAccessibleName(/not in play/);
	await expect(arrival.getByTestId('not-in-play')).toHaveText('Not in play');
	// Not counted: 8 alive of 8, not 9.
	expect(await aliveCount(page)).toBe('8/8');

	// The seat sheet says so, and the Status list can put them in play early or take them out.
	await arrival.tap();
	await seatSheet(page).getByRole('button', { name: 'Status: Not in play' }).tap();
	const status = page.getByRole('dialog', { name: 'Status of Seat 9' });
	await status.getByRole('button', { name: 'Alive', exact: true }).tap();
	await expect(seatSheet(page).getByRole('button', { name: 'Status: Alive' })).toBeVisible();
	await seatSheet(page).getByRole('button', { name: 'Status: Alive' }).tap();
	await status.getByRole('button', { name: 'Not in play', exact: true }).tap();
	await expect(seatSheet(page).getByRole('button', { name: 'Status: Not in play' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();

	// Tonight brings them in.
	await execution(page);
	await expect(arrival).not.toHaveAccessibleName(/not in play/);
	await expect(arrival.getByTestId('not-in-play')).toHaveCount(0);
	await endTheNight(page);
	expect(await aliveCount(page)).toBe('9/9');
});
