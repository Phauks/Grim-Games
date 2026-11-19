import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { walkName, walkNext } from './night-step.ts';
import { pickNumber } from './number-select.ts';
import { tapStartGame } from './start-game.ts';
import { paneIsSheet, storytellerPane } from './players.ts';

// Trevor (2026-11-17): a night step's player picks are made on the board beside it, "same way
// we show valid picks for a reminder token": the seats are marked as for a reminder in hand,
// the pill at the board's foot shows whose pick it is, and a tapped seat fills the pick.

const seat = (page: Page, n: number) =>
	page.locator(`[data-testid="seat"][aria-label^="Seat ${n}:"]`);

async function choose(page: Page, n: number, name: string) {
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await seat(page, n).tap();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${n}` })
		.getByRole('button', { name: new RegExp(`^${name}(, Recommended)?$`) })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("the Fortune Teller's players are picked by tapping their seats", async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await pickNumber(page, 'Players', 7);
	await toBoard(page);
	test.skip(await paneIsSheet(page), 'beside the board only: a phone keeps the drop-down');
	for (const [n, name] of [
		[1, 'Imp'],
		[2, 'Fortune Teller'],
		[3, 'Chef']
	] as const)
		await choose(page, n, name);
	await tapStartGame(
		page,
		page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: 'Start game', exact: true })
	);
	for (let i = 0; i < 20 && (await walkName(page).textContent()) !== 'Fortune Teller'; i++)
		await walkNext(page).tap();
	await expect(walkName(page)).toHaveText('Fortune Teller');
	// Counted among the night's steps, which leave out Dusk and Dawn (Trevor, 2026-11-18).
	await expect(storytellerPane(page).getByTestId('step-count')).toHaveText(/^\d+ of \d+$/);
	await expect(storytellerPane(page).getByTestId('step-progress')).toBeVisible();

	// The first pick waits on the board: the seats it may be marked, the Fortune Teller's
	// own ringed, a seat with no player faded, and the pill shows what is picked.
	const pill = page.getByTestId('reminder-in-hand');
	await expect(pill).toBeVisible();
	await expect(pill).toContainText('Chosen');
	await expect(seat(page, 2)).toHaveAttribute('data-role', /source|both/);
	await expect(seat(page, 3)).toHaveAttribute('data-role', /target|both/);

	// A seat tapped fills the pick and the next one waits; the second fills both.
	const step = storytellerPane(page).getByTestId('night-yes-no');
	await seat(page, 3).tap();
	await expect(step.getByRole('combobox').first()).toContainText('Chef');
	await expect(pill).toContainText('Chosen');
	await seat(page, 1).tap();
	await expect(step.getByRole('combobox').nth(1)).toContainText('Imp');
	await expect(pill).toHaveCount(0);
	// With both chosen, the answers follow: one of them is the Demon, so Yes.
	await expect(step.getByRole('list', { name: 'Valid information' })).toContainText('Yes');
	// No seat sheet opened along the way.
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();

	// Cleared, the pick waits again; × stops it.
	await step.getByRole('combobox').first().tap();
	await page.getByRole('option', { name: 'None' }).tap();
	await expect(pill).toContainText('Chosen');
	await pill.getByRole('button', { name: 'Cancel' }).tap();
	await expect(pill).toHaveCount(0);
	await expect(seat(page, 3)).not.toHaveAttribute('data-misfit');
});
