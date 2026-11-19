import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { inHand, tapToSeat } from './reminder-bank.ts';

// A board token tapped shows as selected (in hand) and moves up over the tokens beside it,
// so it is seen whole (Trevor, 2026-11-19: "it should move up the z layers to be on the top
// of tokens in that area"). The Storyteller's board and a player's grim alike.

/** Each board token's z-index, by whether it is the one in hand. */
async function layers(page: Page) {
	return page.locator('.chip-slot').evaluateAll((slots) =>
		slots.map((slot) => ({
			held: slot.hasAttribute('data-in-hand'),
			z: Number(getComputedStyle(slot).zIndex)
		}))
	);
}

/** The token in hand draws over every other token; put down, it goes back among them. */
async function expectFrontWhileHeld(page: Page, token: Locator) {
	await token.tap();
	await expect(inHand(page)).toBeVisible();
	const held = await layers(page);
	expect(held.filter((l) => l.held)).toHaveLength(1);
	const top = held.find((l) => l.held)!.z;
	for (const other of held.filter((l) => !l.held)) expect(top).toBeGreaterThan(other.z);
	// Nothing over its middle: the tap lands on the token itself.
	const box = (await token.boundingBox())!;
	const hit = await page.evaluate(
		([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-in-hand]'),
		[box.x + box.width / 2, box.y + box.height / 2]
	);
	expect(hit).toBe(true);

	await token.tap();
	await expect(inHand(page)).toBeHidden();
	const down = await layers(page);
	expect(down.filter((l) => l.held)).toHaveLength(0);
	expect(new Set(down.map((l) => l.z)).size).toBe(1);
}

test("the Storyteller's board token in hand is drawn over the tokens beside it", async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const bank = page.getByRole('list', { name: 'Reminder bank' });
	for (let i = 0; i < 3; i++) {
		await tapToSeat(page, bank.getByRole('button', { name: 'Number token' }), 2);
	}
	const onSeat = page.locator('.chip-slot[data-seat="2"]').getByTestId('board-reminder');
	await expect(onSeat).toHaveCount(3);
	await expectFrontWhileHeld(page, onSeat.nth(1));
});

test("a player's grim token in hand is drawn over the tokens beside it", async ({ page }) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	const tray = page.getByRole('list', { name: 'Reminder bank' });
	const seat = page.getByTestId('grim-seat').nth(1);
	// The tray's first three tokens (it keeps them), on one seat.
	for (let i = 0; i < 3; i++) {
		const token = tray.getByRole('button', { name: / reminder$/ }).nth(i);
		await token.scrollIntoViewIfNeeded();
		await token.tap();
		await seat.tap();
		await expect(inHand(page)).toBeHidden();
	}
	const onSeat = page.locator('.chip-slot[data-seat="2"]').getByTestId('board-reminder');
	await expect(onSeat).toHaveCount(3);
	await expectFrontWhileHeld(page, onSeat.nth(1));
});
