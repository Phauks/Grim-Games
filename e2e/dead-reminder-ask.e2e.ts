import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { boardSeat, heldAction, tapToSeat } from './reminder-bank.ts';

/**
 * A Demon's "Dead" put on a living player asks to mark them dead (ReminderAsk.svelte).
 * Trevor's report (2026-11-02, M21): the Vortox's didn't ask on his phone. A tap places a
 * held token on pointerup, and the click after it landed on the question's Cancel.
 */
test("a Dead reminder tapped onto a seat asks to mark the player dead, and the tap doesn't close it", async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Vortox: each night*, the Vortox chooses a player
	// and they die.
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Vortox', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	const bank = page.getByRole('list', { name: 'Reminder bank' });
	for (const seat of [3, 2]) {
		await tapToSeat(page, bank.getByRole('button', { name: 'Dead reminder' }).first(), seat);
		const ask = page.getByRole('alertdialog', {
			name: new RegExp(`^Mark .*Seat ${seat} dead\\?$`)
		});
		await expect(ask).toBeVisible();
		// Still there once the tap's click has come and gone.
		await page.waitForTimeout(500);
		await expect(ask).toBeVisible();
		if (seat === 3) {
			await ask.getByRole('button', { name: 'Cancel', exact: true }).tap();
			await expect(boardSeat(page, seat)).not.toHaveAttribute('aria-label', /dead/);
			// Back to the bank, for the next seat.
			await page
				.locator('.chip-slot[data-seat="3"]')
				.getByRole('button', { name: 'Dead reminder' })
				.tap();
			await heldAction(page, 'Remove reminder');
		} else {
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
			await expect(boardSeat(page, seat)).toHaveAttribute('aria-label', /dead/);
		}
	}
});
