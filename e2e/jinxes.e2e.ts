import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { closeBin, putReminder } from './reminder-bank.ts';

// Jinxes on characters already built (L109): the Plague Doctor's ability that goes to a
// Minion instead of the Storyteller, and the Pit-Hag's jinxes with the Goon, Damsel and Village
// Idiot (each character's Related Jinxes on the wiki,
// https://wiki.bloodontheclocktower.com/Plague_Doctor, https://wiki.bloodontheclocktower.com/Pit-Hag).

/** A new game on a script added from pasted JSON, so both jinxed characters are on it. */
async function startGame(page: Page, name: string, ids: string[]) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(JSON.stringify([{ id: '_meta', name }, ...ids]));
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText(name);
	await page.goto('/new');
	await pickScript(page, name);
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
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

async function choose(page: Page, number: number, name: string) {
	const sheet = await openSeat(page, number);
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: `Character for Seat ${number}` })
		.getByRole('button', { name, exact: true })
		.tap();
	await closeSheet(page);
}

const bankNight = (page: Page, name: 'Start game' | 'Run Night Order' | 'End night') =>
	page.locator('[data-tray]').getByRole('button', { name, exact: true });

/** The walk-through under the board, moved on to the step `title`. */
async function walkTo(page: Page, title: string) {
	const strip = page.getByTestId('night-strip');
	await expect(page.getByRole('list', { name: 'Reminder bank' })).toBeVisible();
	if (!(await strip.isVisible())) {
		await page
			.locator('[data-tray]')
			.getByRole('button', { name: /^(Start game|Run Night Order)$/ })
			.tap();
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

/** The first night ends, then the day, with seat `executed` executed. */
async function toSecondNight(page: Page, executed: number) {
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await bankNight(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();
	const sheet = await openSeat(page, executed);
	await sheet.getByRole('combobox', { name: 'Status: Alive' }).tap();
	await page.getByRole('listbox').getByRole('option', { name: 'Executed' }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the day?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
}

/** Opens a step from the walk-through by its name. */
async function openStep(page: Page, title: string) {
	// Its name: on a phone, a tap on the middle also reached the opened step's icon below it.
	await (
		await walkTo(page, title)
	)
		.locator('.row .ring-main, button.step .name:not(.visually-hidden) strong')
		.tap();
	const step = page.getByRole('dialog', { name: title });
	await expect(step).toBeVisible();
	return step;
}

test("the Plague Doctor's Spy goes to a Minion, who is shown it, not to the Storyteller", async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Plague Spy', [
		'plaguedoctor',
		'imp',
		'spy',
		'poisoner',
		'chef',
		'empath',
		'monk',
		'saint'
	]);
	await choose(page, 1, 'Plague Doctor');
	await choose(page, 2, 'Imp');
	await choose(page, 3, 'Poisoner');
	await choose(page, 4, 'Empath');
	await toSecondNight(page, 1);

	const step = await openStep(page, 'Plague Doctor');
	const row = step.getByTestId('storyteller-ability');
	await expect(row).toContainText('None');
	await row.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: "Storyteller's ability" })
		.getByRole('button', { name: 'Spy', exact: true })
		.tap();
	// The jinx: a Minion gains it instead, so only the living Minion is offered.
	const minions = page.getByRole('dialog', { name: /^Gains the\s*Spy\s*ability$/ });
	await expect(minions.getByRole('listitem')).toHaveCount(1);
	await minions.getByRole('button', { name: /Poisoner/ }).tap();
	await expect(minions).toBeHidden();
	await expect(step.getByTestId('given-instead-note')).toContainText(
		/A\s+Minion\s+gains\s+the\s+Spy\s+ability\s+instead,\s+and\s+learns\s+this\./
	);
	const given = step.getByTestId('given-instead');
	await expect(given).toContainText('Spy');
	await expect(given).toContainText('Seat 3');
	// The Minion learns it: it can be shown to them.
	await expect(given.getByRole('button', { name: 'Show to player' })).toBeVisible();
	await step.getByRole('button', { name: 'Close' }).first().tap();
	await expect(step).toBeHidden();
	// Nothing on the board for the Storyteller.
	await expect(page.getByTestId('storyteller-ability-token')).toHaveCount(0);
});

test("the Pit-Hag's Goon made from an evil player is not offered to turn good", async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Pit Goon', [
		'pithag',
		'imp',
		'goon',
		'damsel',
		'villageidiot',
		'poisoner',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Pit-Hag');
	await choose(page, 2, 'Imp');
	await choose(page, 3, 'Poisoner');
	await choose(page, 4, 'Chef');
	await choose(page, 5, 'Empath');
	await choose(page, 6, 'Village Idiot');
	await toSecondNight(page, 5);

	const step = await openStep(page, 'Pit-Hag');
	// The Damsel jinx: said on the step, as the Storyteller picks the player here.
	await expect(step.getByTestId('storyteller-picks-player')).toContainText(
		/Damsel\s*:\s+the\s+Storyteller\s+chooses\s+which\s+player\s+becomes\s+it\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Changes character' })
		.getByRole('button', { name: /Poisoner/ })
		.tap();
	const picker = page.getByRole('dialog', { name: 'Choose a character' });
	// The Village Idiot jinx: one in play may still be made, with a spare token.
	await expect(picker.getByRole('button', { name: 'Village Idiot', exact: true })).toBeVisible();
	await expect(picker.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0);
	await picker.getByRole('button', { name: 'Goon', exact: true }).tap();
	await expect(step.getByTestId('change-character')).toContainText('Goon');
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();

	// A good player chooses the Goon: no offer to turn them good, by the jinx.
	await putReminder(page, 'Drunk', 4);
	await closeBin(page);
	await expect(page.getByRole('button', { name: /^Seat 4: .*1 reminder/ })).toBeVisible();
	await expect(page.getByRole('alertdialog', { name: /^Make this player/ })).toHaveCount(0);
	await expect(await openSeat(page, 3)).toContainText(/Outsider · Evil · Seat 3[\s\S]*Goon/);
});

// The Leviathan's jinxes (L112): a game end a jinx gives is offered with the jinx's own words
// (https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes).
test("the Grandchild executed with the Leviathan in play offers the end, in the jinx's words", async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Levi Grandchild', [
		'leviathan',
		'grandmother',
		'chef',
		'empath',
		'poisoner',
		'washerwoman'
	]);
	await choose(page, 1, 'Leviathan');
	await choose(page, 2, 'Grandmother');
	await choose(page, 3, 'Chef');
	await putReminder(page, 'Grandchild', 3);
	await closeBin(page);
	const sheet = await openSeat(page, 3);
	await sheet.getByRole('combobox', { name: 'Status: Alive' }).tap();
	await page.getByRole('listbox').getByRole('option', { name: 'Executed' }).tap();
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	const end = prompt.locator('[data-rule="marked-executed"]');
	await expect(end).toContainText('Evil wins');
	await expect(end.getByTestId('end-jinx')).toContainText(/Grandchild\s+dies\s+by\s+execution/);
	await expect(prompt.getByRole('combobox', { name: 'Winner' })).toContainText('Evil');
});

// The Leviathan's night choice (L112): each night after the first it chooses a player on a step
// of its own, before the partner's, and a chosen Sage acts without dying
// (https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes).
test('the Leviathan chooses the Sage at night, and the Sage acts without dying', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Levi Sage', [
		'leviathan',
		'sage',
		'chef',
		'empath',
		'poisoner',
		'washerwoman'
	]);
	await choose(page, 1, 'Leviathan');
	await choose(page, 2, 'Sage');
	await choose(page, 3, 'Chef');
	await toSecondNight(page, 3);

	const step = await openStep(page, 'Leviathan');
	const row = step.getByTestId('jinx-choice');
	await expect(row).toContainText('None');
	await row.getByRole('button', { name: 'Choose' }).tap();
	const chooser = page.getByRole('dialog', { name: 'Leviathan chose' });
	// The executed Chef is faded, still choosable: the Storyteller decides.
	await expect(chooser.locator('button[data-misfit]')).toContainText(['Chef']);
	await chooser.getByRole('button', { name: /Sage/ }).tap();
	await expect(chooser).toBeHidden();
	await expect(row).toContainText('Sage');
	await expect(row.getByRole('button', { name: 'Change' })).toBeVisible();
	const chosen = /chosen by\s*Leviathan\s*,\s*uses their ability but doesn't die/;
	await expect(step.getByTestId('night-alerts')).toContainText(chosen);
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();

	const sage = await openStep(page, 'Sage');
	await expect(sage.getByTestId('night-alerts')).toContainText(chosen);
});

/** The day sheet: Setup before the first night, Day N after it. */
async function openDay(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
	await expect(day).toBeVisible();
	return day;
}

/** Turns on Settings › Storyteller › Track nominations, for the seats' nomination marks. */
async function trackNominations(page: Page) {
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller' })
		.tap();
	await settings.getByText('Track nominations', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
}

/** Taps seat `number`'s nomination marks and picks `nominee`: a seat number or the Storyteller. */
async function nominate(page: Page, number: number, nominee: number | 'Storyteller') {
	await page
		.getByTestId('seat')
		.nth(number - 1)
		.getByTestId('nomination-marks')
		.tap();
	const chooser = page.getByRole('dialog', { name: `Who did Seat ${number} nominate?` });
	if (nominee === 'Storyteller') await chooser.getByTestId('choose-storyteller').tap();
	else await chooser.getByText(`Seat ${nominee}`, { exact: true }).tap();
	await expect(chooser).toBeHidden();
}

// The Riot's jinx with the Mayor (L112): during the riot the Mayor may stop it, on the Riot's
// own row of the day; with one Riot alive, good wins
// (https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes).
test('the Mayor stops the riot from the Riot’s day row, and good wins with one Riot', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Riot Mayor', ['riot', 'mayor', 'chef', 'empath', 'poisoner', 'monk']);
	await choose(page, 1, 'Riot');
	await choose(page, 2, 'Mayor');
	await choose(page, 3, 'Chef');
	await putReminder(page, 'Day 3', 1);
	await closeBin(page);
	const day = await openDay(page);
	const row = day.locator('li[data-character="riot"]').first();
	const stop = row.getByTestId('jinx-stop');
	await expect(stop).toContainText('Stopped by');
	await stop.tap();
	const ask = page.getByRole('alertdialog', { name: /^Did Mayor .* stop the Riot\s?\?$/ });
	await expect(ask).toContainText(/has stopped the\s*Riot/);
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	const end = prompt.locator('[data-rule="partner-stops"]');
	await expect(end).toContainText('Good wins');
	await expect(end.getByTestId('end-jinx')).toContainText(/stop the riot/);
	await expect(prompt.getByRole('combobox', { name: 'Winner' })).toContainText('Good');
});

// The Riot's jinx with the Atheist (L112): during the riot a nominated Storyteller is voted on,
// and when not executed their nominator nominates again, with no warning; executed, the game
// ends (https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes).
test('during the riot a player who nominated the Storyteller nominates again, with no warning', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Riot Atheist', ['riot', 'atheist', 'chef', 'empath', 'poisoner', 'monk']);
	await choose(page, 1, 'Riot');
	await choose(page, 3, 'Chef');
	await putReminder(page, 'Day 3', 1);
	await closeBin(page);
	await trackNominations(page);
	await nominate(page, 3, 'Storyteller');
	// The vote doesn't put the Storyteller to death: Seat 3 nominates again.
	await nominate(page, 3, 4);
	await expect(page.getByText('That player has already nominated today.')).toHaveCount(0);
	// About to die: executed from the day's Execution, and the game ends.
	const day = await openDay(page);
	await day.getByRole('button', { name: 'Execution', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: 'Storyteller', exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	await expect(prompt.locator('[data-rule="storyteller-executed"]')).toContainText('Evil wins');
});

// The Cannibal's jinx with the Zealot (L114): the night after the Cannibal eats the executed
// Zealot, a step of its own wakes the Cannibal to learn the ability, which has no night text
// (https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes).
test('the Cannibal who eats the Zealot is woken to learn the Zealot ability', async ({ page }) => {
	test.slow();
	await startGame(page, 'Cannibal Zealot', [
		'cannibal',
		'zealot',
		'imp',
		'chef',
		'empath',
		'poisoner'
	]);
	await choose(page, 1, 'Cannibal');
	await choose(page, 2, 'Zealot');
	await choose(page, 3, 'Imp');
	await toSecondNight(page, 2);
	await putReminder(page, 'Lunch', 2);
	await closeBin(page);

	const step = await openStep(page, 'Cannibal');
	await expect(step).toContainText('they learn they have the Zealot ability');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/learns they have the\s*Zealot\s*ability/
	);
});

// The Vortox's jinx with the Banshee (L114): the Banshee's announcement is given truly
// (https://wiki.bloodontheclocktower.com/Vortox#Related_Jinxes).
test("the Banshee's step says the Vortox doesn't make its announcement false", async ({ page }) => {
	test.slow();
	await startGame(page, 'Vortox Banshee', [
		'vortox',
		'banshee',
		'chef',
		'empath',
		'poisoner',
		'monk'
	]);
	await choose(page, 1, 'Vortox');
	await choose(page, 2, 'Banshee');
	await choose(page, 3, 'Chef');
	await toSecondNight(page, 3);

	const step = await openStep(page, 'Banshee');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/given truly,\s*Vortox\s*doesn't make\s+it false/
	);
});

// The Cannibal's jinx with the Juggler (L114): the night after the Cannibal eats the executed
// Juggler, the Cannibal's Juggler step says they learn the Juggler's number
// (https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes).
test("the Cannibal who eats the Juggler learns the Juggler's number", async ({ page }) => {
	test.slow();
	await startGame(page, 'Cannibal Juggler', [
		'cannibal',
		'juggler',
		'imp',
		'chef',
		'empath',
		'poisoner'
	]);
	await choose(page, 1, 'Cannibal');
	await choose(page, 2, 'Juggler');
	await choose(page, 3, 'Imp');
	await toSecondNight(page, 2);
	await putReminder(page, 'Lunch', 2);
	await closeBin(page);

	const step = await openStep(page, 'Cannibal');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/learns what the\s*Juggler\s*would learn tonight/
	);
});
