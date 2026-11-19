import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';
import { walkThrough } from './night-step.ts';

/**
 * A token placed inside a night step may end that character's own wake (`wakesWhen.untilToken`:
 * the Courtier's No Ability once it has chosen, https://wiki.bloodontheclocktower.com/Courtier).
 * The step it is placed in stays in tonight's walk-through, so Next still moves on to the
 * characters after it (Trevor, 2026-11-19: the Courtier's token stopped the night order).
 */

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByRole('button', { name, exact: true }).tap();
	await expect(picker).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("the Courtier's No Ability keeps the night going past its step", async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await choose(page, 1, 'Courtier');
	await choose(page, 2, 'Godfather');
	await choose(page, 3, 'Zombuul');
	await choose(page, 4, 'Grandmother');
	const strip = walkThrough(page);
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: /^(Start game|Run Night Order)$/ })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(strip).toBeVisible();
	const name = strip.locator('[data-walk-name]');
	const next = strip.getByRole('button', { name: 'Next step', exact: true });
	for (let i = 0; i < 10 && (await name.textContent()) !== 'Courtier'; i++) await next.tap();
	await expect(name).toHaveText('Courtier');

	// The Courtier chooses the Grandmother: Drunk 1 on them, No Ability on the Courtier.
	await putReminder(page, 'Drunk 1', 4);
	await putReminder(page, 'No Ability', 1);
	await expect(name).toHaveText('Courtier');

	// Next still walks on through every later step.
	const seen: string[] = [];
	for (let i = 0; i < 6 && seen.at(-1) !== 'Dawn'; i++) {
		await next.tap();
		await expect(name).not.toHaveText(seen.at(-1) ?? 'Courtier');
		seen.push((await name.textContent()) ?? '');
	}
	expect(seen).toEqual(['Godfather', 'Grandmother', 'Dawn']);
});
