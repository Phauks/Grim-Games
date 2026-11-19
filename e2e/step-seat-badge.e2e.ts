import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';
import { nightStep, walkThrough, openWalkStep } from './night-step.ts';

/**
 * A night step's reminder row (Trevor, 2026-11-19): the seat the token is on, with its
 * character, only moves the token; it never opens the character, which got in the way. Tapped
 * again beside the board, the token in hand is put down.
 */

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${number}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test("a step's seat badge moves its reminder and never opens the character", async ({ page }) => {
	test.slow();
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await choose(page, 1, 'Grandmother');
	await choose(page, 2, 'Zombuul');
	await putReminder(page, 'Grandchild', 2);

	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = walkThrough(page);
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const name = strip.locator('[data-walk-name]');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== 'Grandmother'; i++) await next.tap();
	await expect(name).toHaveText('Grandmother');
	await openWalkStep(page);
	const step = nightStep(page, 'Grandmother');
	const move = step.getByRole('button', { name: 'Move', exact: true }).first();
	await expect(move).toContainText('Zombuul');

	// Beside the board the step stays; a phone's step is a sheet that steps aside for the board.
	const beside = await step.evaluate((el) => !el.closest('[role="dialog"]'));
	const inHand = page.getByTestId('reminder-in-hand');
	await move.getByText('Zombuul').tap();
	await expect(inHand).toBeVisible();
	// Nothing about the Zombuul opened over the step.
	await expect(page.getByRole('dialog', { name: /Zombuul/ })).toHaveCount(0);
	if (!beside) return;
	await move.tap();
	await expect(inHand).toBeHidden();
});
