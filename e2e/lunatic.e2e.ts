import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Lunatic's night step sells the Demon they believe they are (Trevor, 2026-10-29): fake
 * Minions, a decoy Lunatic, and on later nights the believed Demon's text, whom the Lunatic
 * chose for the real Demon, and the decoy (https://wiki.bloodontheclocktower.com/Lunatic).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${number}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await closeSheet(page);
}

const bank = (page: Page, name: string) =>
	page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name, exact: true });

/** The walk-through under the board, moved to the step named `title`. */
async function openStep(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		const start = page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: /^(Start game|Run Night Order|Execution)$/ });
		const day = (await start.getAttribute('aria-label')) === 'Execution';
		await start.tap();
		if (day) {
			const ask = page.getByRole('alertdialog', { name: 'End the day?' });
			await ask.getByRole('combobox', { name: 'Execution' }).tap();
			await page.getByRole('option', { name: 'No execution', exact: true }).tap();
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
		}
		const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
		await expect(strip.or(ask)).toBeVisible();
		if (await ask.isVisible())
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	}
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	for (let i = 0; i < 30 && (await name.textContent()) !== title; i++)
		await strip.getByRole('button', { name: 'Next step' }).tap();
	await expect(name).toHaveText(title);
	// At its count: the step's name opens the character on a tablet.
	await strip.locator('button.step .count').tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

/** Picks seats in the step's seat chooser, then closes it if it stays open. */
async function pickSeats(page: Page, title: string, numbers: number[], stays: boolean) {
	const chooser = page.getByRole('dialog', { name: title });
	for (const n of numbers)
		await chooser.getByRole('button', { name: new RegExp(`^${n}\\b`) }).tap();
	if (stays) await chooser.getByRole('button', { name: 'Close' }).tap();
	await expect(chooser).toBeHidden();
}

const row = (step: Locator, key: string) => step.locator(`[data-row="${key}"]`);

test('the Lunatic is shown fake Minions and a decoy Lunatic, kept for later nights', async ({
	page
}) => {
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Lunatic');
	await choose(page, 2, 'Po');
	await choose(page, 3, 'Godfather');

	const step = await openStep(page, 'Lunatic');
	await expect(step.getByRole('heading', { name: 'Sell the Demon' })).toBeVisible();
	// Nothing to show until players are chosen.
	await expect(
		row(step, 'minions').getByRole('button', { name: 'Show These are your Minions' })
	).toBeDisabled();
	await row(step, 'minions').getByRole('button', { name: 'Choose' }).tap();
	await pickSeats(page, 'These are your Minions', [4, 5], true);
	await expect(row(step, 'minions')).toContainText('Seat 4');
	await expect(row(step, 'minions')).toContainText('Seat 5');

	// The decoy: another player the Lunatic is told is the Lunatic.
	await row(step, 'decoy').getByRole('button', { name: 'Choose' }).tap();
	await pickSeats(page, 'This player is', [6], false);
	await expect(row(step, 'decoy')).toContainText('Seat 6');
	await row(step, 'decoy').getByRole('button', { name: 'Show This player is' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('This player is');
	await expect(shown).toContainText('Lunatic');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(step).toBeVisible();
	await page.keyboard.press('Escape');

	// Night 2: the Po's own text, and the decoy kept from the first night.
	await bank(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('night-strip')).toBeHidden();
	const later = await openStep(page, 'Lunatic');
	await expect(later.getByRole('heading', { name: /^As the/ })).toContainText('Po');
	await expect(later.getByTestId('believed-demon-text')).toBeVisible();
	await expect(row(later, 'demon-wake')).toContainText('Seat 1');
	await expect(row(later, 'decoy')).toContainText('Seat 6');
	await row(later, 'decoy').getByRole('button', { name: 'Choose' }).tap();
	await pickSeats(page, 'The decoy chose', [7], true);
	await expect(row(later, 'decoy')).toContainText('Seat 7');
});
