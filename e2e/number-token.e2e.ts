import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';
import { heldAction, inHand, tapToSeat } from './reminder-bank.ts';

// The bank's # token (plan M35, Trevor 2026-11-03: "a new generic token that is only used for
// numbers"): it lands showing 1, and its ⋯ > Edit token picks the number from a drop-down. A
// held one picks its number in its pill too (plan M48).

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const onBoard = (page: Page, name: string) =>
	page.locator(`.chip-slot > [data-testid="board-reminder"][aria-label="${name}"]`);

test('the # token lands showing 1 and its number is picked from a drop-down', async ({ page }) => {
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	// Beside the plain ∞, in its cell.
	const number = bank.getByRole('button', { name: 'Number token' });
	await expect(number.locator('[data-symbol="#"]')).toHaveText('#');
	await tapToSeat(page, number, 1);
	const one = onBoard(page, 'Number 1');
	await expect(one).toHaveCount(1);
	await expect(one.locator('[data-symbol]')).toHaveText('1');
	// Never used up, like the ∞.
	await expect(bank.getByRole('button', { name: 'Number token' })).toHaveCount(1);

	// Held, its ⋯ has Edit token: Number first, then its colour and text, no symbol.
	await one.tap();
	await expect(inHand(page)).toBeVisible();
	await heldAction(page, 'Edit token');
	await expect(page.getByRole('combobox', { name: 'Symbol', exact: true })).toHaveCount(0);
	await pickNumber(page, 'Number', 3);
	await page.getByRole('combobox', { name: 'Colour', exact: true }).tap();
	await page.getByRole('option', { name: 'Red', exact: true }).tap();
	const text = page.getByTestId('reminder-note');
	await text.fill('Votes');
	await text.press('Enter');
	await page.keyboard.press('Escape');
	await expect(text).toBeHidden();
	const three = onBoard(page, 'Number 3: Votes');
	await expect(three).toHaveCount(1);
	await expect(three.locator('[data-symbol="#3"]')).toHaveText('3');
});

test('a placed ∞ token is edited from its ⋯ too', async ({ page }) => {
	// Trevor (2026-11-03): he could not find where to give an ∞ token custom information.
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await tapToSeat(page, bank.getByRole('button', { name: 'Generic reminder' }), 1);
	await onBoard(page, 'Generic reminder').tap();
	await heldAction(page, 'Edit token');
	const text = page.getByTestId('reminder-note');
	await text.fill('Chose Sam');
	await text.press('Enter');
	await page.keyboard.press('Escape');
	await expect(onBoard(page, 'Generic reminder: Chose Sam')).toHaveCount(1);
});

test("any number is picked in the held token's pill (plan M48)", async ({ page }) => {
	// Trevor (2026-11-04): "it is easy to add a 1, but any other number requires going in and
	// changing settings".
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	await bank.getByRole('button', { name: 'Number token' }).tap();
	const pill = inHand(page);
	await expect(pill.getByRole('combobox', { name: 'Number', exact: true })).toHaveText(/1/);
	// Picked before it goes down, the token in hand shows it; the board keeps the token held.
	await pickNumber(pill, 'Number', 4);
	await expect(pill.locator('[data-symbol="#4"]')).toHaveText('4');
	await expect(pill).toBeVisible();
	await page.locator('[data-testid="seat"][aria-label^="Seat 2:"]').tap();
	await expect(pill).toBeHidden();
	const four = onBoard(page, 'Number 4');
	await expect(four).toHaveCount(1);

	// A placed one changes in its pill too, with no settings.
	await four.tap();
	await pickNumber(pill, 'Number', 2);
	await expect(onBoard(page, 'Number 2')).toHaveCount(1);
	await expect(onBoard(page, 'Number 4')).toHaveCount(0);

	// Picked up again, the bank's # starts at 1.
	await pill.getByRole('button', { name: 'Put down' }).tap();
	await bank.getByRole('button', { name: 'Number token' }).tap();
	await expect(pill.getByRole('combobox', { name: 'Number', exact: true })).toHaveText(/1/);
});
