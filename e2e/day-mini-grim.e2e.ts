import { expect, test, type Page } from '@playwright/test';
import { chooseExecution } from './execution.ts';
import { pickScript, toBoard } from './new-game.ts';

// The day view's mini grimoire (Trevor, 2026-11-15): the board small and read-only in the
// left column of a wide day, where the executed player can be tapped too. A phone's day has
// no left column, so none.

const daySheet = (page: Page) => page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
const mini = (page: Page) => page.getByTestId('day-mini-grim');

/** A Trouble Brewing game of 8 seats, through the first night to Day 1, with its day open. */
async function toDayOne(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await daySheet(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	await chooseExecution(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	await bank.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(daySheet(page)).toHaveAccessibleName('Day 1');
}

test('a wide day shows the board small, and its Execution is picked there', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'tablet', 'the left column needs a wide screen');
	// The tablet on its side: the day has two columns.
	await page.setViewportSize({ width: 1138, height: 712 });
	await toDayOne(page);
	const seats = mini(page).getByTestId('seat');
	await expect(seats).toHaveCount(8);
	// Read-only: no toolbar, bank or timer of its own.
	await expect(mini(page).getByRole('list', { name: 'Reminder bank' })).toHaveCount(0);
	await expect(mini(page).getByRole('timer')).toHaveCount(0);

	// Execution asks here, and the day stays open.
	await daySheet(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	const bar = page.getByTestId('day-execution-pick');
	await expect(bar).toBeVisible();
	await expect(daySheet(page)).toBeVisible();
	const confirm = daySheet(page).getByRole('button', { name: 'Confirm', exact: true });
	await expect(confirm).toBeDisabled();
	await seats.nth(2).tap();
	await expect(bar.getByTestId('execution-pick-question')).toContainText('Seat 3');
	// Cancel gives Execution back, with nothing done.
	await daySheet(page).getByRole('button', { name: 'Cancel', exact: true }).tap();
	await expect(bar).toHaveCount(0);
	await daySheet(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	await seats.nth(2).tap();
	await confirm.tap();
	// Executed: the day ends and the night starts on the board.
	await expect(daySheet(page)).toBeHidden();
	await expect(page.getByTestId('night-strip')).toBeVisible();
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 3"]')).toHaveAttribute(
		'data-dead',
		'true'
	);
});

test("a phone's day has no mini grimoire, and Execution asks on the board", async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'phone', 'a phone-width day');
	await toDayOne(page);
	await expect(mini(page).getByTestId('seat')).toHaveCount(0);
	await daySheet(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	await expect(daySheet(page)).toBeHidden();
	await expect(page.getByTestId('execution-pick')).toBeVisible();
});
