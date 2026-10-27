import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * Reminders and deaths that change a player's character or alignment offer the change (the
 * `becomes` rule and the Demon's star pass): the Snake Charmer choosing the Demon
 * (https://wiki.bloodontheclocktower.com/Snake_Charmer), the Fang Gu jumping into an Outsider
 * (https://wiki.bloodontheclocktower.com/Fang_Gu) and the Mezepheles's word
 * (https://wiki.bloodontheclocktower.com/Mezepheles).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const seatLabelled = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

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

/** Puts one of `character`'s reminders on a seat from the seat's sheet; the sheet stays open. */
async function addReminder(page: Page, number: number, character: string, label: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Add reminder' }).tap();
	const picker = page.getByRole('dialog', { name: `Reminders for Seat ${number}` });
	await picker.getByRole('group', { name: character }).getByRole('button', { name: label }).tap();
	return { sheet, picker };
}

test("the Snake Charmer's Poisoned on the Demon offers to swap characters and alignments", async ({
	page
}) => {
	await startGame(page);
	await choose(page, 1, 'Snake Charmer');
	await choose(page, 2, 'Vigormortis');
	const { sheet, picker } = await addReminder(page, 2, 'Snake Charmer', 'Poisoned');
	const ask = page.getByRole('alertdialog', { name: 'Swap characters and alignments?' });
	await expect(ask.getByTestId('swap-ask')).toContainText(
		/Seat 2\s*New character\s*Snake Charmer\s*New alignment\s*Good/
	);
	await expect(ask.getByTestId('swap-ask')).toContainText(
		/Seat 1\s*New character\s*Vigormortis\s*New alignment\s*Evil/
	);
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await picker.getByRole('button', { name: 'Close' }).tap();
	await expect(sheet).toContainText(/Snake Charmer\s*Townsfolk · Good · Seat 2/);
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 1: no name, Vigormortis')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 2: no name, Snake Charmer, 1 reminder')).toBeAttached();
});

test('a Fang Gu that kills itself asks which Outsider becomes the evil Fang Gu', async ({
	page
}) => {
	await startGame(page);
	await choose(page, 1, 'Fang Gu');
	await choose(page, 2, 'Klutz');
	// The jump: the Fang Gu dies by its own kill instead of the Klutz.
	const sheet = await openSeat(page, 1);
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 1' })
		.getByRole('button', { name: 'The Demon' })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Choose the new Fang Gu' });
	await expect(ask.getByRole('radio', { name: /Seat 2/, includeHidden: true })).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await closeSheet(page);
	await expect(seatLabelled(page, 'Seat 2: no name, Fang Gu')).toBeAttached();
	await expect(seatLabelled(page, 'Seat 1: no name, Fang Gu')).toHaveAttribute(
		'aria-label',
		/dead/
	);
	const klutz = await openSeat(page, 2);
	await expect(klutz).toContainText(/Fang Gu\s*Demon · Evil · Seat 2/);
	await closeSheet(page);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('taking off the Mezepheles\'s "Turns Evil" offers to make that player evil', async ({
	page
}) => {
	await startGame(page);
	await choose(page, 1, 'Mezepheles', true);
	await choose(page, 2, 'Clockmaker');
	const { picker } = await addReminder(page, 2, 'Mezepheles', 'Turns Evil');
	// Saying the word marks them; they turn evil that night, as the token comes off.
	await expect(page.getByRole('alertdialog', { name: 'Make this player evil?' })).toHaveCount(0);
	await picker.getByRole('button', { name: 'Close' }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Actions for Turns Evil' }).tap();
	await page
		.getByRole('dialog', { name: 'Turns Evil' })
		.getByRole('button', { name: 'Remove reminder' })
		.tap();
	const stays = page.getByRole('alertdialog', { name: 'Confirm change?' });
	if (await stays.isVisible()) await stays.getByRole('button', { name: 'Confirm' }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Make this player evil?' });
	await expect(ask).toContainText(/Character\s*Clockmaker/);
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await expect(sheet).toContainText(/Clockmaker\s*Townsfolk · Evil · Seat 2/);
});
