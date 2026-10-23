import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// Claims players make in town (L56-L58), logged from the seat's ⋯ menu as well as the day
// view: https://wiki.bloodontheclocktower.com/Gossip, /Juggler.

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(sheet.getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet;
}

async function choose(page: Page, number: number, name: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByRole('button', { name, exact: true }).tap();
	await expect(picker).toBeHidden();
	return sheet;
}

async function start(page: Page, script: string) {
	await page.goto('/new');
	await pickScript(page, script);
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

test('the Gossip seat logs a statement, true or false, from the ⋯ menu', async ({ page }) => {
	await start(page, 'Bad Moon Rising');

	const gossip = await choose(page, 1, 'Gossip');
	await gossip.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Statement…' }).tap();
	const note = page.getByRole('dialog', { name: /^Note: Gossip/ });
	await note.getByRole('textbox', { name: 'Statement' }).fill('Seat 3 is the Demon');
	const truth = note.getByRole('checkbox', { name: 'The statement is true', includeHidden: true });
	await note.getByText('The statement is true', { exact: true }).tap();
	await expect(truth).toBeChecked();
	await note.getByRole('button', { name: 'Confirm' }).tap();
	await expect(note).toBeHidden();

	// Opening it again edits the same statement.
	await gossip.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Statement…' }).tap();
	await expect(note.getByRole('textbox', { name: 'Statement' })).toHaveValue('Seat 3 is the Demon');
	await expect(truth).toBeChecked();
	await note.getByRole('button', { name: 'Cancel' }).tap();
	await expect(note).toBeHidden();
});

test('the Juggler seat logs guesses from the ⋯ menu, with the count right so far', async ({
	page
}) => {
	await start(page, 'Sects & Violets');
	await choose(page, 1, 'Witch');
	await page.keyboard.press('Escape');
	const juggler = await choose(page, 2, 'Juggler');
	await juggler.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Guesses…' }).tap();
	const guesses = page.getByRole('dialog', { name: /^Note: Juggler/ });
	await expect(guesses.getByTestId('correct-guesses')).toHaveText('0 correct');
	await guesses.getByRole('combobox', { name: /^Guess for Seat 1/ }).tap();
	await page.getByRole('option', { name: 'Witch', exact: true }).tap();
	await expect(guesses.getByTestId('correct-guesses')).toHaveText('1 correct');
});
