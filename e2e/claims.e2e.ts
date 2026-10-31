import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

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
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
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
	await guesses.getByRole('combobox', { name: 'Player for guess 1' }).tap();
	await page.getByRole('option', { name: 'Seat 1', exact: true }).tap();
	await guesses.getByRole('combobox', { name: 'Character for guess 1' }).tap();
	await page.getByRole('option', { name: 'Witch', exact: true }).tap();
	await expect(guesses.getByTestId('correct-guesses')).toHaveText('1 correct');
});

// https://wiki.bloodontheclocktower.com/Amnesiac: each day the Amnesiac guesses its ability
// in private, and the Storyteller answers Cold, Warm, Hot or Bingo.
test('the Amnesiac seat logs its daily guess with the answer, from the ⋯ menu', async ({
	page
}) => {
	await start(page, 'Trouble Brewing');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Amnesiac', exact: true }).tap();
	await expect(picker).toBeHidden();
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Guess…' }).tap();
	const note = page.getByRole('dialog', { name: /^Note: Amnesiac/ });
	await note.getByRole('textbox', { name: 'Guess' }).fill('Do I learn about Minions?');
	await note.getByRole('button', { name: 'Answer' }).tap();
	await page.getByRole('option', { name: 'Hot', exact: true }).tap();
	await note.getByRole('button', { name: 'Confirm' }).tap();
	await expect(note).toBeHidden();

	// Opening it again edits the same guess and answer.
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Guess…' }).tap();
	await expect(note.getByRole('textbox', { name: 'Guess' })).toHaveValue(
		'Do I learn about Minions?'
	);
	await expect(note.getByRole('combobox', { name: 'Answer' })).toHaveValue('Hot');
});

// The answers are a range (Trevor, 2026-10-31): one in the Storyteller's own words, such as
// Lukewarm, is typed into the answer field; either kind is shown to the player from the note.
test('the Amnesiac’s answer can be the Storyteller’s own words, shown to the player', async ({
	page
}) => {
	await start(page, 'Trouble Brewing');
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Amnesiac', exact: true }).tap();
	await expect(picker).toBeHidden();
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Guess…' }).tap();
	const note = page.getByRole('dialog', { name: /^Note: Amnesiac/ });
	await note.getByRole('textbox', { name: 'Guess' }).fill('Do I learn about Minions?');
	const show = note.getByRole('button', { name: 'Show to player' });
	await expect(show).toBeDisabled();
	const answer = note.getByRole('combobox', { name: 'Answer' });
	await answer.fill('Lukewarm');
	await page.getByRole('option', { name: 'Use “Lukewarm”' }).tap();
	await expect(show).toBeEnabled();
	await expect(answer).toHaveValue('Lukewarm');
	await show.tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown).toContainText('Lukewarm');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toHaveCount(0);
	await note.getByRole('button', { name: 'Confirm' }).tap();
	await expect(note).toBeHidden();

	// Kept: opening it again shows the same answer.
	await sheet.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Guess…' }).tap();
	await expect(note.getByRole('combobox', { name: 'Answer' })).toHaveValue('Lukewarm');
});
