import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Dragging a reminder onto the bank's "+ New token" makes a new ∞ token like it (Trevor,
// 2026-10-27), and the + glows while a reminder is dragged.

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

const centreOf = async (locator: Locator) => {
	const b = (await locator.boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** Picks a token up (straight up first, so the bank doesn't scroll) and moves it to `to`. */
async function lift(page: Page, token: Locator, to: Locator) {
	await to.scrollIntoViewIfNeeded();
	const from = await centreOf(token);
	const at = await centreOf(to);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x, from.y - 60, { steps: 4 });
	await page.mouse.move(at.x, at.y, { steps: 8 });
}

test('a reminder dropped on "+ New token" becomes a new ∞ token with its words and look', async ({
	page
}) => {
	await startGame(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const plus = bank.getByRole('button', { name: 'New token' });
	await expect(plus).not.toHaveAttribute('data-glow');

	// A character's reminder from the bank: its words; it stays in the bank. The + glows
	// while it is carried, brighter under it.
	const poisoned = bank.getByRole('button', { name: 'Poisoned reminder' });
	await lift(page, poisoned, plus);
	await expect(plus).toHaveAttribute('data-glow', 'over');
	await page.mouse.up();
	await expect(plus).not.toHaveAttribute('data-glow');
	const copy = bank.getByRole('button', { name: 'Generic reminder: Poisoned' });
	await expect(copy).toHaveCount(1);
	await expect(poisoned).toBeVisible();
	// It shows the Poisoner's art, and while carried marks the seats as Poisoned does: the
	// Poisoner's seat as its source (Trevor, 2026-10-27).
	await expect(copy.locator('img')).toHaveAttribute('src', /.+/);
	const seat1 = page.locator('[data-testid="seat"][aria-label^="Seat 1:"]');
	await lift(page, copy, page.getByRole('button', { name: /^Seat 5:/ }));
	await expect(seat1).toHaveAttribute('data-role', /source|both/);
	await page.mouse.up();

	// An ∞ token with its own text and symbol: a second one just like it.
	await plus.tap();
	await page.getByTestId('reminder-note').fill('Red herring');
	await page.getByRole('combobox', { name: 'Symbol', exact: true }).tap();
	await page.getByRole('option').nth(1).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('reminder-note')).toBeHidden();
	const herring = bank.getByRole('button', { name: 'Generic reminder: Red herring' });
	await expect(herring).toHaveCount(1);
	const symbol = await herring.locator('[data-symbol]').getAttribute('data-symbol');
	expect(symbol).toBeTruthy();
	await lift(page, herring, plus);
	await page.mouse.up();
	await expect(herring).toHaveCount(2);
	await expect(herring.nth(1).locator('[data-symbol]')).toHaveAttribute('data-symbol', symbol!);

	// One on the board: the + glows while it is carried, and the reminder stays on its seat.
	await poisoned.tap();
	const chooser = page.getByRole('dialog', { name: /^Put/ });
	await chooser.getByRole('button', { name: /Seat 3/ }).tap();
	await expect(chooser).toBeHidden();
	await expect(page.locator('[data-scope="dialog"][data-part="backdrop"]')).toHaveCount(0);
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 3:"]')).toHaveAttribute(
		'aria-label',
		/1 reminder/
	);
	const placed = page
		.getByRole('button', { name: 'Poisoned reminder' })
		.and(page.locator(':not([data-pan])'));
	const from = await centreOf(placed);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 20, from.y + 20, { steps: 4 });
	await expect(plus).toHaveAttribute('data-glow', 'ready');
	await plus.scrollIntoViewIfNeeded();
	const at = await centreOf(plus);
	await page.mouse.move(at.x, at.y, { steps: 8 });
	await expect(plus).toHaveAttribute('data-glow', 'over');
	await page.mouse.up();
	await expect(bank.getByRole('button', { name: 'Generic reminder: Poisoned' })).toHaveCount(2);
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 3:"]')).toHaveAttribute(
		'aria-label',
		/1 reminder/
	);
});
