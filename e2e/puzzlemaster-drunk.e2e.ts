import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';
import { nightStep, walkThrough, openWalkStep } from './night-step.ts';

/**
 * The player the Puzzlemaster makes drunk (https://wiki.bloodontheclocktower.com/Puzzlemaster)
 * may be shown anything: a drunk Grandmother's Grandchild may be any player, so no seat is
 * faded while it is placed (Trevor, 2026-11-19). The Puzzlemaster's Drunk comes first in the
 * bank's Setup group, as Is The Drunk does.
 */

async function choose(page: Page, number: number, name: string, offScript = false) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

const seat = (page: Page, n: number) =>
	page.locator(`[data-testid="seat"][aria-label^="Seat ${n}:"]`);

test('a Grandmother made drunk by the Puzzlemaster may have any Grandchild', async ({ page }) => {
	test.slow();
	await page.goto('/new');
	await pickScript(page, 'Bad Moon Rising');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await choose(page, 1, 'Puzzlemaster', true);
	await choose(page, 2, 'Grandmother');
	await choose(page, 3, 'Zombuul');
	await choose(page, 4, 'Godfather');

	// The Puzzlemaster's Drunk leads the Setup group, before the Grandchild.
	const setup = page.getByRole('list', { name: 'Reminder bank' }).getByRole('button');
	await expect(setup.first()).toHaveAccessibleName('Drunk reminder');
	await putReminder(page, 'Drunk', 2);

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
	await expect(step.getByTestId('step-afflictions')).toBeVisible();

	// Placing the Grandchild: the evil players are not faded.
	await step.getByText('Not placed').first().tap();
	await expect(seat(page, 1)).not.toHaveAttribute('data-misfit');
	await expect(seat(page, 3)).not.toHaveAttribute('data-misfit');
	await expect(seat(page, 4)).not.toHaveAttribute('data-misfit');
	await page.screenshot({
		path: `test-results/puzzlemaster-drunk-grandchild-${test.info().project.name}.png`
	});
});
