import { expect, type Page } from '@playwright/test';
import { tapStartGame } from './start-game.ts';

/**
 * Answers the day's Execution, already asked: on the board's bar (Trevor, 2026-11-06: the
 * executed player is tapped on the board, then confirmed), or on the Execution sheet, which
 * asks instead before Start game, with the Atheist on the script, and when executing the player
 * has more to decide. `choice` is No execution, the Storyteller (the Atheist), or a seat by its
 * label, such as "Seat 3".
 */
export async function chooseExecution(page: Page, choice = 'No execution'): Promise<void> {
	const bar = page.getByTestId('execution-pick');
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(bar.or(ask)).toBeVisible();
	const seat = /^Seat \d+$/.test(choice);
	if (await bar.isVisible()) {
		if (seat) await page.locator(`[data-testid="seat"][aria-label^="${choice}:"]`).tap();
		else await bar.getByRole('button', { name: choice, exact: true }).tap();
		// The bank's own button is Confirm while the bar shows.
		const confirm = page
			.locator('[data-tray]')
			.getByRole('button', { name: 'Confirm', exact: true });
		await expect(confirm.and(page.locator(':enabled')).or(ask)).toBeVisible();
		if (await bar.isVisible()) {
			await confirm.tap();
			await expect(bar).toBeHidden();
			return;
		}
	}
	const field = ask.getByRole('combobox', { name: 'Execution' });
	if (!seat || !(await field.textContent())?.includes(choice)) {
		await field.tap();
		await page
			.getByRole('option', {
				name: seat ? new RegExp(`\\b${choice}(\\s|$)`) : choice,
				exact: !seat
			})
			.tap();
	}
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

/** The reminder bank's end button: Execution by day, End night by night. */
export const bankExecution = (page: Page) =>
	page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Execution', exact: true });

/**
 * Asks the day's Execution from the bank, the only Execution since the Day moved into the pane
 * (Trevor, 2026-11-16); a phone's pane closes first, as it covers the bank.
 */
export async function startExecution(page: Page): Promise<void> {
	const sheet = page.getByRole('dialog', { name: 'Game', exact: true });
	const closeSheet = async () => {
		if (!(await sheet.isVisible())) return;
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
	};
	await closeSheet();
	// Before Day 1 the bank ends the first night instead: ended here, as the Day's Execution
	// used to skip it. Dawn opens the Day, over the board on a phone.
	const endNight = page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'End night', exact: true });
	const start = page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true });
	const setUp = page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Set up', exact: true });
	await expect(bankExecution(page).or(endNight).or(start).or(setUp)).toBeVisible();
	if (await setUp.isVisible()) {
		// No Demon yet: the last seat with no character is the Imp, so the game can start.
		await page.locator('[data-testid="seat"][aria-label*="no character"]').last().tap();
		const seatSheet = page.locator('[data-scope="drawer"][data-part="content"]');
		await seatSheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: /^Character for Seat \d+$/ })
			.getByRole('button', { name: /^Imp(, Recommended)?$/ })
			.tap();
		await page.keyboard.press('Escape');
		await expect(seatSheet).toBeHidden();
		await expect(start).toBeVisible();
	}
	if (await start.isVisible()) {
		await tapStartGame(page, start);
		await expect(endNight).toBeVisible();
	}
	if (await endNight.isVisible()) {
		await endNight.tap();
		const ask = page.getByRole('alertdialog', { name: 'End the night?' });
		await expect(ask.or(bankExecution(page)).or(sheet).first()).toBeVisible();
		if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm' }).tap();
		await expect(bankExecution(page).or(sheet).first()).toBeVisible();
		await closeSheet();
	}
	await bankExecution(page).tap();
}

/**
 * Picks the executed player on the board's bar and confirms it there; when executing them has
 * more to decide, the Execution sheet opens, and is returned for the test to answer.
 */
export async function pickExecuted(page: Page, choice: string) {
	const bar = page.getByTestId('execution-pick');
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(bar).toBeVisible();
	if (/^Seat \d+$/.test(choice))
		await page.locator(`[data-testid="seat"][aria-label^="${choice}:"]`).tap();
	else await bar.getByRole('button', { name: choice, exact: true }).tap();
	const confirm = page
		.locator('[data-tray]')
		.getByRole('button', { name: 'Confirm', exact: true })
		.and(page.locator(':enabled'));
	await expect(ask.or(confirm)).toBeVisible();
	if (!(await ask.isVisible())) await confirm.tap();
	return ask;
}

/** Start game and End night, as startExecution does, then back out of Execution: Day 1. */
export async function toDayOne(page: Page): Promise<void> {
	await startExecution(page);
	const bar = page.getByTestId('execution-pick');
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(bar.or(ask)).toBeVisible();
	if (await bar.isVisible()) await bar.getByRole('button', { name: 'Cancel' }).tap();
	else await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(bar.or(ask)).toHaveCount(0);
}
