import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { tapToSeat } from './reminder-bank.ts';

/**
 * A token that takes the place of an earlier one on the same player asks to take that one off
 * (Trevor, 2026-11-06: "placing has should request taking mad off"). The Pukka's Dead goes
 * where its Poisoned was (https://wiki.bloodontheclocktower.com/Pukka: the poisoned player
 * dies, marked Dead, then their Poisoned comes off).
 */
test("placing the Pukka's Dead asks to take its Poisoned off", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Pukka', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	const bank = page.getByRole('list', { name: 'Reminder bank' });
	const onSeat2 = page.locator('.chip-slot[data-seat="2"]');
	await tapToSeat(page, bank.getByRole('button', { name: 'Poisoned reminder' }).first(), 2);
	await expect(onSeat2.getByRole('button', { name: 'Poisoned reminder' })).toHaveCount(1);
	await tapToSeat(page, bank.getByRole('button', { name: 'Dead reminder' }).first(), 2);
	const ask = page.getByRole('alertdialog', { name: /^Take .*Poisoned.* off\?$/ });
	await expect(ask).toBeVisible();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	// Then the Dead token's own question.
	const dead = page.getByRole('alertdialog', { name: /^Mark .* dead\?$/ });
	await expect(dead).toBeVisible();
	await dead.getByRole('button', { name: 'Cancel', exact: true }).tap();
	await expect(onSeat2.getByRole('button', { name: 'Poisoned reminder' })).toHaveCount(0);
	await expect(onSeat2.getByRole('button', { name: 'Dead reminder' })).toHaveCount(1);
});
