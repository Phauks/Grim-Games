/** A Trouble Brewing game taken into its second night, for night step tests. */
import { closePane, paneIsSheet } from './players.ts';
import { chooseExecution } from './execution.ts';
import { expect, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';
import { nightStep, walkThrough, openWalkStep } from './night-step.ts';

export async function startGame(page: Page) {
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

export async function choose(page: Page, number: number, name: string, offScript = false) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await closeSheet(page);
}

export async function poison(page: Page, number: number) {
	await putReminder(page, 'Poisoned', number);
}

async function walkTo(page: Page, title: string) {
	const strip = walkThrough(page);
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
	const name = strip.locator('[data-walk-name]');
	await expect(name).toBeVisible();
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) await next.tap();
	await expect(name).toHaveText(title);
	return strip;
}

/** Ends the first night, then the day with `executed` executed, into the second night. */
export async function toNightTwo(page: Page, executed: string) {
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
	const day = page.getByTestId('pane-day');
	await closePane(page);
	if (await paneIsSheet(page)) await expect(day).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Execution', exact: true })
		.tap();
	await chooseExecution(page, executed);
}

export async function openStep(page: Page, title: string) {
	await walkTo(page, title);
	await openWalkStep(page);
	const dialog = nightStep(page, title);
	await expect(dialog).toBeVisible();
	return dialog;
}
