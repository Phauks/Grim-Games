import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Fang Gu jumping into an Outsider (https://wiki.bloodontheclocktower.com/Fang_Gu): the
 * old Fang Gu dies but the Demon lives on, so it is no game end. Trevor's report
 * (2026-10-27): the jump asked to end the game, and after the game was reopened the Fang
 * Gu's "Dead" stopped asking to mark the player dead.
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const seatLabelled = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet;
}

async function choose(page: Page, number: number, name: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${number}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await closeSheet(page);
}

/** Puts one of the Fang Gu's reminders on a seat from the seat's sheet. */
async function addFangGu(page: Page, number: number, label: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	await page
		.getByRole('dialog', { name: `Reminders for Seat ${number}` })
		.getByRole('group', { name: 'Fang Gu' })
		.getByRole('button', { name: label })
		.tap();
}

/** The old Fang Gu is dead, so placing its reminder asks first (Trevor, 2026-10-20). */
async function confirmPlaceDead(page: Page) {
	await page
		.getByRole('alertdialog', { name: /^Place Dead/ })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
}

test('a Fang Gu jumping into an Outsider is no game end, and its Dead still asks', async ({
	page
}) => {
	await startGame(page);
	await choose(page, 1, 'Fang Gu');
	await choose(page, 2, 'Klutz');

	// The jump: "Once" then "Dead" on the Fang Gu, which dies instead of the Klutz.
	await addFangGu(page, 1, 'Once');
	await page.keyboard.press('Escape');
	await closeSheet(page);
	await addFangGu(page, 1, 'Dead');
	await page
		.getByRole('alertdialog', { name: /^Mark .*Seat 1 dead\?$/ })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(seatLabelled(page, 'Seat 1:')).toHaveAttribute('aria-label', /dead/);
	// It asks who becomes the Fang Gu (character-changes.e2e.ts); not yet here.
	await page
		.getByRole('alertdialog', { name: 'Choose the new Fang Gu' })
		.getByRole('button', { name: 'Cancel', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await closeSheet(page);
	await expect(page.getByRole('alertdialog', { name: 'End game?' })).toHaveCount(0);

	// The Klutz dies too, before becoming the Fang Gu: nobody is left to jump into, so the
	// game end asks. Confirmed, then reopened, it doesn't ask again straight away.
	await addFangGu(page, 2, 'Dead');
	await confirmPlaceDead(page);
	await page
		.getByRole('alertdialog', { name: /^Mark .*Seat 2 dead\?$/ })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();
	await page.keyboard.press('Escape');
	await closeSheet(page);
	await page.getByTestId('game-over').tap();
	await page
		.getByRole('alertdialog', { name: 'Reopen game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(page.getByTestId('game-over')).toHaveCount(0);
	await expect(end).toHaveCount(0);

	// The Fang Gu's next "Dead" still asks.
	await addFangGu(page, 3, 'Dead');
	await confirmPlaceDead(page);
	await expect(page.getByRole('alertdialog', { name: /^Mark .*Seat 3 dead\?$/ })).toBeVisible();
	await expect(end).toHaveCount(0);
});
