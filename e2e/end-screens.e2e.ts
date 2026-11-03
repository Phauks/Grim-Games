import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The screens Trevor picked on 2026-11-03 for the bigger How to Run mechanics (M32): the
 * Fiddler's contest in its own dialog (https://wiki.bloodontheclocktower.com/Fiddler), the
 * Politician as a Winner of its own (https://wiki.bloodontheclocktower.com/Politician) and the
 * Beggar's vote tokens added on the Beggar's sheet (https://wiki.bloodontheclocktower.com/Beggar).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const sheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await expect(sheet(page).getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet(page);
}

async function closeSeat(page: Page) {
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
}

/** Gives a seat a character, from the script or (with `offScript`) from any. */
async function choose(page: Page, number: number, name: string, offScript = false) {
	const seat = await openSeat(page, number);
	await seat.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await closeSeat(page);
}

async function markDead(page: Page, number: number) {
	const seat = await openSeat(page, number);
	await seat.getByRole('combobox', { name: 'Status: Alive' }).tap();
	const status = page.getByRole('listbox');
	await status.getByRole('option').filter({ hasNotText: 'Alive' }).first().tap();
	await expect(status).toBeHidden();
	await closeSeat(page);
}

async function menu(page: Page, action: string) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: action, exact: true })
		.tap();
}

test('the fiddle contest runs in its own dialog and opens End game with its result', async ({
	page
}) => {
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Chef');
	await choose(page, 2, 'Imp');
	await menu(page, 'Add Fabled or Loric');
	const adding = page.getByRole('dialog', { name: 'Add Fabled or Loric' });
	await adding.getByRole('button', { name: 'Fiddler', exact: true }).tap();
	await expect(adding).toBeHidden();

	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
	await day.locator('li[data-character="fiddler"]').getByTestId('day-contest').tap();
	const contest = page.getByRole('alertdialog', { name: /Fiddler\s+contest/ });
	await expect(contest).toBeVisible();
	// The Demon chooses: the only one is already picked.
	await expect(contest.getByRole('combobox', { name: 'Demon', exact: true })).toContainText(
		'Seat 2'
	);
	await expect(contest.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
	// Only good players may be picked.
	await contest.getByRole('combobox', { name: 'Picked', exact: true }).tap();
	await expect(page.getByRole('option', { name: /Seat 2/ })).toHaveCount(0);
	await page.getByRole('option', { name: /Seat 1/ }).tap();
	// No votes yet: a tie, which evil wins.
	await expect(contest.getByTestId('contest-result')).toHaveText(/Tie\s*Evil wins/);
	await contest.getByRole('combobox', { name: 'Votes for Picked' }).tap();
	await page.getByRole('option', { name: '3', exact: true }).tap();
	await expect(contest.getByTestId('contest-result')).toHaveText(/^\s*Good wins\s*$/);
	await contest.screenshot({ path: `test-results/fiddle-contest-${test.info().project.name}.png` });
	await contest.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// End game opens over the board with the contest's winner and the Fiddler as how it ended.
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await expect(end).toBeVisible();
	await expect(day).toBeHidden();
	await expect(end.getByRole('combobox', { name: 'Winner' })).toContainText('Good');
	await expect(end.getByRole('combobox', { name: 'How it ended' })).toContainText('Fiddler');
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();
});

test('a Politician is a Winner of its own beside evil', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Politician', true);
	await choose(page, 2, 'Imp');
	await menu(page, 'End game');
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	// Good, Evil, Evil and the Politician, Not recorded: the Politician always wins with good.
	await expect(page.getByRole('option')).toHaveCount(4);
	await page.getByRole('option', { name: /^Evil\s*and/ }).tap();
	await expect(end.getByRole('combobox', { name: 'Winner' })).toContainText(/Evil\s*and/);
	await expect(end.getByRole('combobox', { name: 'Winner' })).toContainText('Politician');
	await end.screenshot({ path: `test-results/politician-wins-${test.info().project.name}.png` });
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toBeVisible();
});

test("a dead player's vote token is added on the Beggar's sheet", async ({ page }) => {
	test.slow();
	await startGame(page);
	await choose(page, 2, 'Recluse');
	await markDead(page, 2);
	let seat = await openSeat(page, 1);
	await seat.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: /^Beggar/ })
		.first()
		.tap();
	await page.getByRole('dialog', { name: 'Alignment' }).getByRole('button', { name: 'Good' }).tap();
	await expect(seat.getByTestId('vote-token-count')).toHaveText('0');
	await seat.getByTestId('vote-token-add').tap();
	const add = page.getByRole('alertdialog', { name: 'Add vote token' });
	// The only dead player gives it; a Recluse may register as evil, so either may be told.
	await expect(add.getByRole('combobox', { name: 'From' })).toContainText('Seat 2');
	await expect(add.getByTestId('vote-token-tell')).toHaveText(/Good\s*or\s*Evil/);
	await add.screenshot({ path: `test-results/beggar-token-${test.info().project.name}.png` });
	await add.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(seat.getByTestId('vote-token-count')).toHaveText('1');
	await closeSeat(page);
	// The giver's ghost vote is spent.
	seat = await openSeat(page, 2);
	await expect(seat.getByRole('button', { name: 'Ghost vote' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
