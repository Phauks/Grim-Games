import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { inHand, openBin } from './reminder-bank.ts';

// The seats say what the token in hand is for, the same on a player's grim as on the
// Storyteller's board (Trevor, 2026-11-10: Local Grim "does not show this"): its character's
// seat ringed, the seats it fits glowing, the ones it doesn't faded. One rule (hand-marks.ts),
// drawn by the seat both grims share (SeatDisc).

const disc = (page: Page, seat: number) =>
	page
		.getByTestId('grim-seat')
		.nth(seat - 1)
		.locator('.seat-disc');

async function guess(page: Page, seat: number, name: string) {
	await page
		.getByTestId('grim-seat')
		.nth(seat - 1)
		.tap();
	const sheet = page.getByRole('dialog', { name: new RegExp(`Seat ${seat}`) });
	const pick = sheet.getByRole('button', { name, exact: true });
	await pick.scrollIntoViewIfNeeded();
	await pick.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test('Local Grim marks the seats for a token in hand, by the characters they show', async ({
	page
}) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await guess(page, 2, 'Monk');
	await guess(page, 3, 'Fortune Teller');
	await guess(page, 4, 'Poisoner');
	await expect(page.locator('.seat-disc[data-role], .seat-disc[data-misfit]')).toHaveCount(0);

	// The Red Herring goes on a good player
	// (https://wiki.bloodontheclocktower.com/Fortune_Teller#How_to_Run).
	await (
		await openBin(page)
	)
		.getByRole('button', { name: 'Red Herring reminder', exact: true })
		.first()
		.tap();
	await expect(inHand(page)).toBeVisible();
	await expect(disc(page, 3)).toHaveAttribute('data-role', 'both');
	await expect(disc(page, 2)).toHaveAttribute('data-role', 'target');
	await expect(disc(page, 4)).toHaveAttribute('data-misfit', 'true');
	await expect(disc(page, 4)).not.toHaveAttribute('data-role');
	// A seat with no character shown may take it.
	await expect(disc(page, 1)).toHaveAttribute('data-role', 'target');

	// Put down, the marks go.
	await inHand(page).getByRole('button', { name: 'Put down' }).tap();
	await expect(inHand(page)).toBeHidden();
	await expect(page.locator('.seat-disc[data-role], .seat-disc[data-misfit]')).toHaveCount(0);
});

test("the Storyteller's board marks its seats with the same seat look", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await (await openBin(page)).getByRole('button', { name: 'Generic reminder' }).first().tap();
	await expect(inHand(page)).toBeVisible();
	// No characters yet: every seat may take it.
	await expect(page.locator('[data-testid="seat"] .seat-disc[data-role="target"]')).toHaveCount(8);
});
