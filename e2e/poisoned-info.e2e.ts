import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';

/**
 * A drunk or poisoned player may be given any information, true or false
 * (https://wiki.bloodontheclocktower.com/Poisoner), so their night step offers the false
 * answers too, beside the true one (Trevor, 2026-10-27). Who poisoned them is the step's
 * Afflictions only, not repeated under Valid Information.
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-scope="drawer"][data-part="content"]')).toBeHidden();
}

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet;
}

async function choose(page: Page, number: number, name: string, offScript = false) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await closeSheet(page);
}

async function poison(page: Page, number: number) {
	await putReminder(page, 'Poisoned', number);
}

async function walkTo(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		const start = page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: /^(Start game|Run Night Order)$/ });
		await start.tap();
		const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
		await expect(strip.or(ask)).toBeVisible();
		if (await ask.isVisible())
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	}
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) await next.tap();
	await expect(name).toHaveText(title);
	return strip;
}

/** Ends the first night, then the day with `executed` executed, into the second night. */
async function toNightTwo(page: Page, executed: string) {
	const strip = await walkTo(page, 'Dusk');
	await expect(strip).toBeVisible();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Execution', exact: true })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: executed }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

async function openStep(page: Page, title: string) {
	const strip = await walkTo(page, title);
	await strip.locator('button.step').tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

test('a poisoned Oracle is offered every count, not only the true one', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Oracle', true);
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Chef');
	await choose(page, 5, 'Empath');
	await toNightTwo(page, 'Seat 4');
	await poison(page, 1);

	const step = await openStep(page, 'Oracle');
	const suggested = step.getByTestId('night-suggested');
	// The true count first, then every other count up to the dead players (one: the Chef).
	const rows = suggested.getByTestId('answer-options').getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toHaveAttribute('data-reason', 'true');
	await expect(rows.nth(0).locator('.option strong')).toHaveText('0');
	await expect(rows.nth(1)).toHaveAttribute('data-reason', 'unreliable');
	await expect(rows.nth(1).locator('.option strong')).toHaveText('1');
	// Who poisoned the Oracle is under Afflictions, not here as well.
	await expect(suggested).not.toContainText('poisoned');
	await expect(step.getByText('Afflictions')).toBeVisible();
	await page.screenshot({ path: `test-results/poisoned-oracle-${test.info().project.name}.png` });
	await rows.nth(1).getByRole('button', { name: 'Show to player' }).tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toContainText('1');
});

test('a poisoned Undertaker may be shown any other character', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Undertaker');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Slayer');
	await toNightTwo(page, 'Seat 4');
	await poison(page, 1);

	const step = await openStep(page, 'Undertaker');
	const rows = step.getByTestId('answer-options').getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0).locator('[data-character-id="slayer"]').first()).toBeVisible();
	const other = rows.nth(1);
	await expect(other).toContainText('Any other');
	const show = other.getByRole('button', { name: 'Show to player' });
	// Nothing picked yet: the list is ringed, and Show to player opens it (Trevor, 2026-10-28).
	const shownAs = other.getByRole('combobox', { name: 'Shown as' });
	await expect(shownAs).toHaveAttribute('data-attention');
	await expect(async () => {
		await show.tap();
		await page.getByRole('option', { name: 'Washerwoman' }).tap({ timeout: 2000 });
	}).toPass();
	await expect(shownAs).not.toHaveAttribute('data-attention');
	await page.screenshot({
		path: `test-results/poisoned-undertaker-${test.info().project.name}.png`
	});
	await show.tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toContainText('Washerwoman');
});
