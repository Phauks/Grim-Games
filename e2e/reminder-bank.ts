import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Reminders go on seats from the bank only (Trevor, 2026-10-29: no list on the seat's sheet):
 * the bank pulled up by its handle bar to show every token, then a token dragged onto a seat.
 */

/** The bank's handle bar, which pulls it up or down (a tap toggles it). */
export const bankHandle = (page: Page) => page.getByRole('button', { name: 'Every reminder' });

/** The bank pulled up to show every token. */
export async function openBin(page: Page): Promise<Locator> {
	const bin = page.getByTestId('reminder-bin');
	if (!(await bin.isVisible())) {
		await bankHandle(page).tap();
		await expect(bin).toBeVisible();
	}
	return bin;
}

/** The bank back down to its row, if it is pulled up. */
export async function closeBin(page: Page): Promise<void> {
	const bin = page.getByTestId('reminder-bin');
	if (await bin.isVisible()) await bankHandle(page).tap();
	await expect(bin).toBeHidden();
}

/** A token in the pulled-up bank by its words (`Generic reminder` for the ∞). */
export async function binToken(page: Page, label: string, nth = 0): Promise<Locator> {
	const bin = await openBin(page);
	const name = label === 'Generic reminder' ? label : `${label} reminder`;
	return bin.getByRole('button', { name, exact: true }).nth(nth);
}

/**
 * Drags a token from the pulled-up bank onto the seat whose label starts `Seat N:` (or the
 * label given). The bank then closes back to its row (Trevor, 2026-11-02).
 */
export async function dragToSeat(page: Page, token: Locator, seat: number | string) {
	const start = typeof seat === 'number' ? `Seat ${seat}:` : seat;
	const target = page.locator(`[data-testid="seat"][aria-label^="${start}"]`);
	const from = (await token.boundingBox())!;
	const to = (await target.boundingBox())!;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 20, { steps: 6 });
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 });
	await page.mouse.up();
}

/** Puts a reminder from the bank on a seat, and closes the bank's sheet unless a dialog asks. */
export async function putReminder(page: Page, label: string, seat: number | string, nth = 0) {
	await dragToSeat(page, await binToken(page, label, nth), seat);
	await expect(page.locator('.lowered [data-testid="reminder-bin"]')).toHaveCount(0);
	if ((await page.getByRole('alertdialog').count()) === 0) await closeBin(page);
}

/** The board's seat whose label starts `Seat N:` (or the label given). */
export const boardSeat = (page: Page, seat: number | string) =>
	page.locator(
		`[data-testid="seat"][aria-label^="${typeof seat === 'number' ? `Seat ${seat}:` : seat}"]`
	);

/** The pill of the token in hand (Trevor, 2026-10-30: a tap holds a token). */
export const inHand = (page: Page) => page.getByTestId('reminder-in-hand');

/** Taps a token to hold it, then the seat it goes on. */
export async function tapToSeat(page: Page, token: Locator, seat: number | string) {
	await token.tap();
	await expect(inHand(page)).toBeVisible();
	await boardSeat(page, seat).tap();
	await expect(inHand(page)).toBeHidden();
}

/** Picks a row of the held token's ⋯. */
export async function heldAction(page: Page, row: string) {
	// Edit is the pill's own button (Trevor, 2026-11-10, option B); the trash is under ⋯.
	if (PILL_BUTTONS.includes(row)) {
		await inHand(page).getByRole('button', { name: row, exact: true }).tap();
		return;
	}
	await inHand(page).getByRole('button', { name: 'More reminder actions' }).tap();
	await page.getByRole('menuitem', { name: row, exact: true }).tap();
}
const PILL_BUTTONS = ['Edit token'];

/**
 * Picks an ∞ token's symbol or colour in its editor (GenericLookFields), opening the symbol tab
 * that holds it (Symbols, Emoji or Characters; Trevor, 2026-11-10, option B). Tapping the one
 * already chosen clears it.
 */
export async function pickLook(page: Page, name: string) {
	const radio = page.getByRole('radio', { name, exact: true });
	for (const tab of ['Symbols', 'Emoji', 'Characters']) {
		if (await radio.isVisible()) break;
		await page.getByRole('tab', { name: tab, exact: true }).tap();
	}
	await radio.locator('..').tap();
}

/** Opens the ⋯ of an ∞ token's editor (GenericLookDialog) and picks a row. */
export async function editorAction(page: Page, row: string) {
	await page
		.getByRole('dialog', { name: /token/ })
		.getByRole('button', { name: 'More token actions' })
		.tap();
	await page.getByRole('menuitem', { name: row, exact: true }).tap();
}

/** Saves an ∞ token's editor (GenericLookDialog): Confirm. */
export async function confirmToken(page: Page) {
	await page.getByRole('dialog', { name: /token/ }).getByRole('button', { name: 'Confirm' }).tap();
}

/** Taps a seat's token on the board to hold it, then the seat it moves to (Trevor, 2026-10-30). */
export async function moveOnBoard(page: Page, label: string, from: number, to: number) {
	await page
		.locator(`.chip-slot[data-seat="${from}"]`)
		.getByRole('button', { name: `${label} reminder` })
		.tap();
	await expect(inHand(page)).toBeVisible();
	await boardSeat(page, to).tap();
}

/**
 * Puts a later token of a counting run on a seat (plan M53, Trevor 2026-11-06: a run is
 * stacked as one token in the bin, its next token on top): the stack held from the bin, the
 * token picked in its pill, then the seat tapped.
 */
export async function putRunReminder(page: Page, label: string, seat: number | string) {
	const bin = await openBin(page);
	const word = label.split(' ')[0];
	await bin
		// A borrowed ability's copy is named for its holder ("Night 1 reminder, Alchemist's copy").
		.getByRole('button', { name: new RegExp(`^${word} \\d+ reminder(, .+)?$`) })
		// The stack, after any of the run's tokens still waiting in Setup.
		.last()
		.tap();
	const pill = inHand(page);
	await expect(pill).toBeVisible();
	await pill.getByRole('combobox', { name: 'Token', exact: true }).tap();
	await page.getByRole('option', { name: label, exact: true }).tap();
	await boardSeat(page, seat).tap();
	await expect(pill).toBeHidden();
}

/**
 * Places (or moves) a night step's reminder from the step (Trevor, 2026-11-06: "revert back to
 * grim view, not a tabled list"): the step closes with the token in hand, the seat is tapped on
 * the board, and the step opens again.
 */
export async function placeFromStep(
	page: Page,
	step: Locator,
	seat: number | string,
	{ nth = 0, button = 'Place' }: { nth?: number; button?: 'Place' | 'Move' } = {}
) {
	await step.getByRole('button', { name: button, exact: true }).nth(nth).tap();
	await expect(step).toBeHidden();
	await expect(inHand(page)).toBeVisible();
	await boardSeat(page, seat).tap();
	await expect(inHand(page)).toBeHidden();
	await expect(step).toBeVisible();
}
