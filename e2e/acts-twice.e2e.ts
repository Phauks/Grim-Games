import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';

/**
 * A player marked to act twice wakes again straight after their own step, as a second step
 * of the walk-through (M15c, https://wiki.bloodontheclocktower.com/Barista: they act, sleep,
 * then wake to act again), and the step says so.
 */

async function choose(page: Page, number: number, name: string, traveller = false) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (traveller) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await expect(picker).toBeHidden();
	// A Traveller (off the script here) asks for their alignment.
	if (traveller)
		await page
			.getByRole('dialog', { name: 'Alignment' })
			.getByRole('button', { name: 'Good', exact: true })
			.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function startNight(page: Page) {
	const strip = page.getByTestId('night-strip');
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: /^(Start game|Run Night Order)$/ })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(strip).toBeVisible();
	return strip;
}

test('a player who acts twice wakes again for their step', async ({ page }) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await choose(page, 1, 'Poisoner');
	await choose(page, 2, 'Imp');
	await choose(page, 3, 'Chef');
	await choose(page, 4, 'Barista', true);
	await putReminder(page, 'Acts Twice', 1);

	const strip = await startNight(page);
	const name = strip.locator('.step .name strong');
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== 'Poisoner'; i++) await next.tap();
	await expect(name).toHaveText('Poisoner');
	await expect(strip.getByTestId('night-alerts')).toContainText('acts twice tonight');

	await next.tap();
	await expect(name).toHaveText('Poisoner again');
	await expect(strip.locator('.who')).toHaveText('Seat 1');
	await expect(strip.getByTestId('night-alerts')).toContainText('acts twice tonight');

	// The second wake opens like the first, with its own title.
	await strip.locator('button.step').tap();
	await expect(page.getByRole('dialog', { name: 'Poisoner again' })).toBeVisible();
});
