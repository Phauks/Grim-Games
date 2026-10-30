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
 * label given). The sheet stays open, under any dialog the drop asks; `closeBin` closes it.
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
	await inHand(page).getByRole('button', { name: 'More reminder actions' }).tap();
	await page.getByRole('menuitem', { name: row, exact: true }).tap();
}
