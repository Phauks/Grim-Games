import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { pickNumber } from './number-select.ts';
import { boardSeat, inHand, putReminder } from './reminder-bank.ts';

// The controls for wiki examples the engine now runs (M17a-g): the Wizard's wish, the
// Yaggababble's phrase count, the Angel's Something Bad, the Ojo's named character, the
// Al-Hadikhia's live or die, and the Knaves' two Storytellers.

/** Adds a script from its JSON in the Library, then starts a five-player game of it. */
async function newGame(page: Page, name: string, ids: string[]) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(JSON.stringify([{ id: '_meta', name }, ...ids]));
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText(name);
	await page.goto('/new');
	await pickScript(page, name);
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await pickNumber(page, 'Players', 5);
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(5);
}

const sheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

/** Gives each seat in turn its character, from the seat's sheet. */
async function cast(page: Page, names: string[]) {
	for (const [i, name] of names.entries()) {
		await page.getByRole('button', { name: new RegExp(`^Seat ${i + 1}:`) }).tap();
		await expect(sheet(page).getByRole('button', { name: 'Edit player name' })).toBeVisible();
		await sheet(page).getByRole('button', { name: 'Choose' }).tap();
		const picker = page.getByRole('dialog', { name: `Character for Seat ${i + 1}` });
		await picker.getByRole('button', { name, exact: true }).tap();
		await expect(picker).toBeHidden();
		await page.keyboard.press('Escape');
		await expect(sheet(page)).toBeHidden();
	}
}

/** A Fabled or Loric put in play from the board's ⋯. */
async function addRuleCharacter(page: Page, name: string) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Fabled or Loric', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name, exact: true })
		.tap();
}

const bank = (page: Page) => page.locator('[data-tray]');

/** Start game, then the first night ended: day 1, whose day view opens on its own. */
async function toDay1(page: Page) {
	await bank(page).getByRole('button', { name: 'Start game', exact: true }).tap();
	const start = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(start)).toBeVisible();
	if (await start.isVisible()) await start.getByRole('button', { name: 'Confirm' }).tap();
	await endNight(page);
}

async function endNight(page: Page) {
	await bank(page).getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(dayView(page)).toBeVisible();
}

const dayView = (page: Page) => page.getByRole('dialog', { name: /^Day \d+$/ });

/** The day ended with no execution, from the day view, into the night. */
async function endDay(page: Page) {
	await dayView(page).getByRole('button', { name: 'Execution', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /^No execution(\s|$)/ }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('night-strip')).toBeVisible();
}

/** Opens tonight's step for `title` from the walk-through under the board. */
async function openStep(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	const name = strip.locator('.step .name strong');
	await expect(name).toBeVisible();
	for (const way of ['Next step', 'Previous step']) {
		const button = strip.getByRole('button', { name: way });
		for (let i = 0; i < 30 && (await name.textContent()) !== title; i++) {
			if (await button.isDisabled()) break;
			const [at, of] = ((await strip.locator('.count').textContent()) ?? '').split(' of ');
			if (way === 'Next step' && at === of) break;
			await button.tap();
		}
	}
	await expect(name).toHaveText(title);
	// By its name: a tap on the step's text could land on a character named in it.
	await name.tap();
	const dialog = page.getByRole('dialog', { name: title });
	await expect(dialog).toBeVisible();
	return dialog;
}

// https://wiki.bloodontheclocktower.com/Wizard: once per game, the Wizard may make a wish.
test('the Wizard’s wish is recorded from its day row, and its reminder goes', async ({ page }) => {
	test.setTimeout(90_000);
	await newGame(page, 'Wish Check', ['wizard', 'chef', 'empath', 'spy', 'imp']);
	await cast(page, ['Wizard', 'Chef', 'Empath', 'Spy', 'Imp']);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	await expect(page.getByText('may make a wish')).toHaveCount(1);

	const chip = page.getByTestId('wish');
	await expect(chip).toHaveCount(1);
	await chip.tap();
	const dialog = page.getByRole('dialog', { name: 'Wish' });
	await dialog.getByRole('textbox', { name: 'What they wished for' }).fill('Know the Demon');
	await dialog.getByRole('textbox', { name: 'Price' }).fill('Seat 2 is mad');
	await dialog.getByRole('button', { name: 'Save' }).tap();
	await expect(dialog).toBeHidden();

	// Granted: the reminder goes and the chip is marked.
	await expect(page.getByText('may make a wish')).toHaveCount(0);
	await expect(chip).toHaveAttribute('data-marked', 'true');
	// Reopened, it holds the same wish.
	await chip.tap();
	await expect(dialog.getByRole('textbox', { name: 'What they wished for' })).toHaveValue(
		'Know the Demon'
	);
});

// https://wiki.bloodontheclocktower.com/Yaggababble: each time its phrase is said today, one
// player may die by its ability.
test('the Yaggababble’s phrase count on its day row shows on its night step', async ({ page }) => {
	test.setTimeout(120_000);
	await newGame(page, 'Phrase Check', ['chef', 'empath', 'investigator', 'spy', 'yaggababble']);
	await cast(page, ['Chef', 'Empath', 'Investigator', 'Spy', 'Yaggababble']);
	await toDay1(page);
	const tally = page.getByRole('combobox', { name: 'Phrase said today', exact: true });
	await expect(tally).toHaveCount(1);
	await pickNumber(page, 'Phrase said today', '2 times');
	await expect(tally).toContainText('2 times');

	await endDay(page);
	const step = await openStep(page, 'Yaggababble');
	await expect(step.getByTestId('tally-kills')).toHaveText('Phrase said today: 2, may kill 2');
});

// https://wiki.bloodontheclocktower.com/Angel: something bad happens to whoever is most
// responsible for a protected player's death; the Storyteller picks what.
test('the Angel’s Something Bad reminder says what happens', async ({ page }) => {
	test.setTimeout(90_000);
	await newGame(page, 'Angel Check', ['chef', 'empath', 'investigator', 'spy', 'imp']);
	await addRuleCharacter(page, 'Angel');
	await putReminder(page, 'Something Bad', 2);
	await expect(boardSeat(page, 2)).toHaveAttribute('aria-label', /1 reminder/);

	await page.locator('.chip-slot[data-seat="2"] [data-testid="board-reminder"]').first().tap();
	await inHand(page).getByRole('button', { name: 'About this reminder' }).tap();
	const about = page.getByRole('dialog', { name: 'Something Bad' });
	const effect = about.getByTestId('reminder-effect');
	await effect.getByRole('combobox', { name: 'What happens' }).tap();
	await page.getByRole('option', { name: 'Kills no one next night' }).tap();
	await expect(effect.getByRole('combobox', { name: 'What happens' })).toContainText(
		'Kills no one next night'
	);
	await effect.getByRole('textbox', { name: 'Note' }).fill('Seat 3 made it happen');
	await effect.getByRole('textbox', { name: 'Note' }).press('Enter');

	// Kept on the token.
	await about.getByRole('button', { name: 'Close' }).tap();
	await expect(about).toBeHidden();
	if (await inHand(page).isVisible()) await page.keyboard.press('Escape');
	await page.locator('.chip-slot[data-seat="2"] [data-testid="board-reminder"]').first().tap();
	await inHand(page).getByRole('button', { name: 'About this reminder' }).tap();
	await expect(about.getByRole('combobox', { name: 'What happens' })).toContainText(
		'Kills no one next night'
	);
	await expect(about.getByRole('textbox', { name: 'Note' })).toHaveValue('Seat 3 made it happen');
});

// https://wiki.bloodontheclocktower.com/Ojo: the Ojo chooses a character; its player dies.
test('the Ojo’s step names a character and marks its player dead', async ({ page }) => {
	test.setTimeout(120_000);
	await newGame(page, 'Ojo Check', ['chef', 'empath', 'investigator', 'spy', 'ojo']);
	await cast(page, ['Chef', 'Empath', 'Investigator', 'Spy', 'Ojo']);
	await toDay1(page);
	await endDay(page);
	const step = await openStep(page, 'Ojo');
	const named = step.getByTestId('named-kill');
	await expect(named).toContainText('None');
	await named.getByRole('button', { name: 'Choose' }).tap();
	const picker = page.getByRole('dialog', { name: 'Named character' });
	await picker.getByRole('button', { name: 'Empath', exact: true }).tap();
	await expect(picker).toBeHidden();
	await expect(named).toContainText('Empath');
	const mark = step.getByRole('button', { name: 'Mark dead' });
	await expect(mark).toHaveCount(1);
	await mark.tap();
	await expect(mark).toBeDisabled();
	await expect(boardSeat(page, 2)).toHaveAttribute('aria-label', /dead/i);
});

// https://wiki.bloodontheclocktower.com/Al-Hadikhia: each chosen player chooses to live or
// die; if all live, all die.
test('the Al-Hadikhia’s step asks each chosen player live or die', async ({ page }) => {
	test.setTimeout(120_000);
	await newGame(page, 'Hadikhia Check', ['chef', 'empath', 'investigator', 'spy', 'alhadikhia']);
	await cast(page, ['Chef', 'Empath', 'Investigator', 'Spy', 'Al-Hadikhia']);
	await toDay1(page);
	await endDay(page);
	await putReminder(page, '1', 1);
	await putReminder(page, '2', 2);
	const step = await openStep(page, 'Al-Hadikhia');
	const rows = step.getByTestId('live-or-die').getByRole('listitem');
	await expect(rows).toHaveCount(2);
	const apply = step.getByRole('button', { name: 'Apply' });
	await expect(apply).toBeDisabled();
	// Both live: all die.
	for (const i of [0, 1]) {
		await rows.nth(i).getByRole('combobox', { name: 'Live or die' }).tap();
		await page.getByRole('option', { name: 'Live', exact: true }).tap();
	}
	await expect(rows.nth(0)).toContainText('Dies');
	await expect(rows.nth(1)).toContainText('Dies');
	await apply.tap();
	await expect(boardSeat(page, 1)).toHaveAttribute('aria-label', /dead/i);
	await expect(boardSeat(page, 2)).toHaveAttribute('aria-label', /dead/i);
});

// https://wiki.bloodontheclocktower.com/Knaves: two Storytellers, one of whom lies.
test('with the Knaves, an info step asks which Storyteller the player went to', async ({
	page
}) => {
	test.setTimeout(120_000);
	await newGame(page, 'Knaves Check', ['chef', 'empath', 'investigator', 'spy', 'imp']);
	await cast(page, ['Chef', 'Empath', 'Investigator', 'Spy', 'Imp']);
	await addRuleCharacter(page, 'Knaves');
	await bank(page).getByRole('button', { name: 'Start game', exact: true }).tap();
	const start = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(start)).toBeVisible();
	if (await start.isVisible()) await start.getByRole('button', { name: 'Confirm' }).tap();
	const step = await openStep(page, 'Chef');

	// Names and who lies, from the gear.
	const group = step.getByRole('group', { name: /^Which Storyteller .* went to$/ });
	await group.getByRole('button', { name: 'Storytellers' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Storytellers' });
	await dialog.getByRole('textbox', { name: 'Storyteller 1, name' }).fill('Ann');
	await dialog.getByRole('textbox', { name: 'Storyteller 2, name' }).fill('Bo');
	await dialog.getByRole('combobox', { name: 'Who lies' }).tap();
	await page.getByRole('option', { name: 'Bo', exact: true }).tap();
	await dialog.getByRole('button', { name: 'Save' }).tap();
	await expect(dialog).toBeHidden();

	const chips = group.getByTestId('storyteller-visit');
	await expect(chips).toHaveCount(2);
	await expect(chips.nth(0)).toHaveText('Ann');
	await expect(chips.nth(1)).toContainText('Bo');
	await expect(chips.nth(1)).toContainText('lies');
	const what = step.getByTestId('storyteller-what');
	await chips.nth(1).tap();
	await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
	await expect(what).toHaveText('The lying Storyteller: the information must be false.');
	await chips.nth(0).tap();
	await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
	await expect(what).toHaveText('The truthful Storyteller: normal information.');
	// A second tap clears it.
	await chips.nth(0).tap();
	await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false');
	await expect(what).toHaveText('');

	// Switch, from the dialog, swaps who lies.
	await group.getByRole('button', { name: 'Storytellers' }).tap();
	await dialog.getByRole('button', { name: 'Switch' }).tap();
	await expect(dialog).toBeHidden();
	await expect(chips.nth(0)).toContainText('lies');
	await expect(chips.nth(1)).not.toContainText('lies');
});
