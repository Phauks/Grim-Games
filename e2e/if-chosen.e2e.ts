import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';
import { nightStep } from './night-step.ts';

// A killing step's "If chosen" rows (Trevor, 2026-11-03, option B): each player the kill could
// hit, their badge once and the outcome in words, no icons.
async function startGame(page: Page, script = 'Trouble Brewing') {
	await page.goto('/new');
	await pickScript(page, script);
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
const bankNight = (
	page: Page,
	name: 'Set up' | 'Start game' | 'Run Night Order' | 'End night' | 'Execution'
) =>
	// The bank's own box, which keeps its run button while Seating's bar takes its tokens' row.
	page.locator('[data-tray]').getByRole('button', { name, exact: true });

/**
 * Ending the day asks who was executed (Trevor, 2026-10-22); No execution unless a player
 * is named.
 */
async function chooseExecution(page: Page, choice = 'No execution') {
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: choice, exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

/**
 * The walk-through under the board, on this step: the night order left the board (Trevor,
 * 2026-10-18), so Run night starts it and Next (which ticks each step) or Previous finds it.
 */
/** Whether the walk-through is on its last step (the count leaves out Dusk and Dawn). */
async function lastStep(strip: Locator) {
	return (await strip.getAttribute('data-step')) === (await strip.getAttribute('data-steps'));
}

async function walkTo(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	// A step closing hides the board from the a11y tree for a moment; wait it out.
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		const start = page
			.getByRole('list', { name: 'Reminder bank' })
			.locator('..')
			.getByRole('button', { name: /^(Start game|Run Night Order|Execution)$/ });
		const day = (await start.getAttribute('aria-label')) === 'Execution';
		await start.tap();
		if (day) await chooseExecution(page);
		// Setup reminders still to place: Start game asks first (Trevor, 2026-10-20).
		const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
		await expect(strip.or(ask)).toBeVisible();
		if (await ask.isVisible())
			await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	}
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	for (const way of ['Next step', 'Previous step']) {
		const button = strip.getByRole('button', { name: way });
		for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) {
			if (await button.isDisabled()) break;
			// Next stays enabled on the last step, where it points at End night.
			if (way === 'Next step' && (await lastStep(strip))) break;
			await button.tap();
		}
	}
	await expect(name).toHaveText(title);
	return strip;
}

async function endNight(page: Page) {
	await bankNight(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
}

test("the Demon's step lists who can't die or sets something off, once each, in words", async ({
	page
}) => {
	// https://wiki.bloodontheclocktower.com/Soldier : safe from the Demon.
	// https://wiki.bloodontheclocktower.com/Klutz : its ability is set off when it learns it died.
	// https://wiki.bloodontheclocktower.com/Mayor : the Demon's kill may land elsewhere.
	// https://wiki.bloodontheclocktower.com/Sweetheart : its death makes one player drunk.
	await startGame(page, 'Sects & Violets');
	for (const [seat, name, offScript] of [
		[1, 'Vigormortis', false],
		[2, 'Klutz', false],
		[3, 'Sweetheart', false],
		[4, 'Soldier', true],
		[5, 'Mayor', true]
	] as const) {
		const sheet = await openSeat(page, seat);
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${seat}` });
		const pick = picker.getByRole('button', { name, exact: true });
		if (offScript && !(await pick.count()))
			await picker.getByText('Include characters not on the script').tap();
		await pick.tap();
		await closeSheet(page);
	}
	await walkTo(page, 'Dusk');
	await endNight(page);
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(day).toBeHidden();
	// The Sweetheart's Drunk on the Klutz.
	await putReminder(page, 'Drunk', 2);

	const strip = await walkTo(page, 'Vigormortis');
	await expect(strip.getByTestId('step-if-chosen')).toContainText(/Soldier\s*Seat 4\s*Can't die/);
	await strip.locator('.row .ring-main, button.step .name:not(.visually-hidden) strong').tap();
	const step = nightStep(page, 'Vigormortis');
	const rows = step.getByTestId('step-if-chosen').getByRole('listitem');
	await expect(step.getByRole('heading', { name: 'If chosen', level: 3 })).toBeVisible();
	await expect(rows.filter({ hasText: 'Soldier' })).toHaveText(
		/^\s*Soldier\s*Seat 4\s*Can't die\s*$/
	);
	await expect(rows.filter({ hasText: 'Mayor' })).toHaveText(
		/^\s*Mayor\s*Seat 5\s*May bounce the death\s*$/
	);
	await expect(rows.filter({ hasText: 'Klutz' })).toHaveText(
		/^\s*Klutz\s*Seat 2\s*Sets off its ability\s*,\s*drunk, by\s*Sweetheart\s*Seat 3\s*$/
	);
	await expect(rows.filter({ hasText: /^\s*Sweetheart/ })).toHaveText(
		/^\s*Sweetheart\s*Seat 3\s*Sets off its ability\s*$/
	);
	// No icons, and none of these left in the step's other state lines.
	await expect(step.getByTestId('step-if-chosen').locator('[data-icon]')).toHaveCount(0);
	await expect(step.getByTestId('night-alerts')).toHaveCount(0);
});
