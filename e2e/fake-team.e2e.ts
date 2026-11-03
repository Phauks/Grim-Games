import { expect, test, type Page } from '@playwright/test';
import { pickNumber } from './number-select.ts';
import { toBoard } from './new-game.ts';

/*
 * The Atheist's fake evil team (M26b, https://wiki.bloodontheclocktower.com/Atheist): with the
 * Atheist in play the Storyteller fakes Minions and a Demon. A seat's Fake drop-down sets who it
 * fakes at any time (Trevor, 2026-11-02), the board marks it in the seat's bottom-right pill
 * (Option A), and the night wakes the fake character on that seat.
 */

const seatSheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await expect(seatSheet(page).getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return seatSheet(page);
}

async function closeSeat(page: Page) {
	await page.keyboard.press('Escape');
	await expect(seatSheet(page)).toBeHidden();
}

async function choose(page: Page, number: number, name: string, offScript = false) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: new RegExp(`^${name}(,|$)`) }).tap();
	const ask = page.getByRole('dialog', { name: 'Alignment' });
	if (await ask.isVisible().catch(() => false))
		await ask.getByRole('button', { name: 'Good' }).tap();
	await closeSeat(page);
}

async function setFake(page: Page, number: number, name: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('combobox', { name: 'Fake' }).tap();
	await page.getByRole('option', { name, exact: true }).tap();
	await closeSeat(page);
}

test('the Storyteller fakes a seat as a Minion, marked on the board and woken at night (M26b)', async ({
	page
}) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await pickNumber(page, 'Players', 7);
	await toBoard(page);

	// No Atheist: no Fake row.
	await choose(page, 1, 'Chef');
	const sheet = await openSeat(page, 1);
	await expect(sheet.getByTestId('sheet-fake')).toHaveCount(0);
	await closeSeat(page);

	await choose(page, 2, 'Atheist', true);
	await setFake(page, 1, 'Poisoner');
	const mark = page.getByTestId('pretend-character');
	await expect(mark).toHaveCount(1);
	await expect(mark).toHaveAttribute('title', 'Fake Poisoner');
	await expect(page.getByRole('button', { name: /^Seat 1:.*fake Poisoner/ })).toBeAttached();

	// Changed mid-game, then cleared.
	await setFake(page, 1, 'Imp');
	await expect(mark).toHaveAttribute('title', 'Fake Imp');
	await setFake(page, 1, 'Poisoner');

	// The first night wakes the fake Poisoner on Seat 1.
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
	const name = strip.locator('.step .name strong');
	const next = strip.getByRole('button', { name: 'Next step' });
	for (let i = 0; i < 30 && (await name.textContent()) !== 'Fake Poisoner'; i++) await next.tap();
	await expect(name).toHaveText('Fake Poisoner');

	await setFake(page, 1, 'None');
	await expect(mark).toHaveCount(0);
});
