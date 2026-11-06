import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { closeBin, putReminder, putRunReminder } from './reminder-bank.ts';
import { nightStep } from './night-step.ts';

// Jinxes on characters already built (L109): the Plague Doctor's ability that goes to a
// Minion instead of the Storyteller, and the Pit-Hag's jinxes with the Goon, Damsel and Village
// Idiot (each character's Related Jinxes on the wiki,
// https://wiki.bloodontheclocktower.com/Plague_Doctor, https://wiki.bloodontheclocktower.com/Pit-Hag).

/** A new game on a script added from pasted JSON, so both jinxed characters are on it. */
async function startGame(page: Page, name: string, ids: unknown[]) {
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
	const step = nightStep(page, title);
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
	await putRunReminder(page, 'Day 3', 1);
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
	await putRunReminder(page, 'Day 3', 1);
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

// An announcement shows its character as the night strip does, big icon and name with no
// ability under it (Trevor, 2026-11-04), and what to announce in the row.
test('the Vizier is announced on Day 1 as a named row without its ability', async ({ page }) => {
	test.slow();
	await startGame(page, 'Vizier Announced', ['vizier', 'imp', 'chef', 'empath', 'monk']);
	await choose(page, 1, 'Vizier');
	await choose(page, 3, 'Imp');
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await bankNight(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	const vizier = day.getByTestId('announcements').locator('[data-character="vizier"]');
	await expect(vizier).toHaveCount(1);
	await expect(vizier.locator('.ring-row')).toBeVisible();
	await expect(vizier.locator('.ring-ability')).toHaveCount(0);
	await expect(vizier).toContainText('Vizier');
	// Nobody dies on the first night, so Day 1 doesn't say so (Trevor, 2026-11-04).
	await expect(day.getByTestId('announcements')).not.toContainText('Nobody died');
});

// The Vizier's jinxes (L115): with the Investigator on the script the Vizier isn't declared, and
// the Magician is immune to the Vizier's execute now, warned beside it, never locked
// (https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes).
test("the Vizier isn't declared with the Investigator, and the Magician is out of their execute now", async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Vizier Magician', [
		'vizier',
		'investigator',
		'magician',
		'imp',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Vizier');
	await choose(page, 2, 'Magician');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Chef');
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await bankNight(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	await expect(day.getByTestId('announcements')).toBeVisible();
	await expect(day.getByTestId('announcements').locator('[data-character="vizier"]')).toHaveCount(
		0
	);

	await day.getByRole('button', { name: 'Execution', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	const now = ask.getByTestId('outcome-execute-now');
	await expect(now).toBeVisible();
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /\bSeat 2\b/ }).tap();
	await expect(now).toContainText('A jinx keeps it from this player');
	await ask.getByRole('combobox', { name: 'Execution' }).tap();
	await page.getByRole('option', { name: /\bSeat 4\b/ }).tap();
	await expect(now).not.toContainText('A jinx keeps it from this player');
});

// The Vizier wakes with the Fearmonger, and a Vizier the Courtier makes drunk learns it and
// still can't die by day: both said at the partner's night step (L115,
// https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes).
test("the Vizier's jinxes with the Fearmonger and the Courtier show at their night steps", async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Vizier Fear', [
		'vizier',
		'fearmonger',
		'courtier',
		'chef',
		'empath',
		'monk',
		'imp'
	]);
	await choose(page, 1, 'Vizier');
	await choose(page, 2, 'Fearmonger');
	await choose(page, 3, 'Courtier');
	await choose(page, 4, 'Chef');
	await putReminder(page, 'Drunk 3', 1);
	await closeBin(page);

	const courtier = await openStep(page, 'Courtier');
	await expect(courtier.getByTestId('night-alerts')).toContainText(
		/Vizier\s*,\s*learns\s+they\s+lost\s+their\s+ability,\s+which\s+still\s+protects\s+them/
	);
	await page.keyboard.press('Escape');
	await expect(courtier).toBeHidden();

	const fear = await openStep(page, 'Fearmonger');
	await expect(fear.getByTestId('night-alerts')).toContainText(
		/Vizier\s*,\s*wakes\s+too\s+and\s+learns\s+the\s+choice/
	);
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

// Lil' Monsta's babysitting jinxes (L116, https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Related_Jinxes):
// a Vizier babysitting Lil' Monsta dies when executed, so the Execution sheet no longer says
// they survive.
test('a Vizier babysitting Lil’ Monsta is no longer saved from execution', async ({ page }) => {
	test.slow();
	await startGame(page, 'Babysitting Vizier', [
		'lilmonsta',
		'vizier',
		'poisoner',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Vizier');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Chef');
	const first = await walkTo(page, 'Dusk');
	await first.getByRole('button', { name: 'Next step' }).tap();
	await bankNight(page, 'End night').tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const day = page.getByRole('dialog', { name: 'Day 1' });
	const executeSeat1 = async () => {
		await day.getByRole('button', { name: 'Execution', exact: true }).tap();
		const ask = page.getByRole('alertdialog', { name: 'End the day?' });
		await ask.getByRole('combobox', { name: 'Execution' }).tap();
		await page.getByRole('option', { name: /\bSeat 1\b/ }).tap();
		return ask;
	};
	let ask = await executeSeat1();
	await expect(ask.getByTestId('execution-saved')).toContainText('does not die');
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(ask).toBeHidden();
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(day).toBeHidden();

	await putReminder(page, 'Is The Demon', 1);
	await closeBin(page);
	await openDay(page);
	ask = await executeSeat1();
	await expect(ask.getByTestId('execution-saved')).not.toContainText('does not die');
});

// With the Magician alive, the Storyteller picks a Minion to babysit Lil' Monsta: Is The
// Demon on anyone else is still placed, with a toast that a jinx says who carries it (L116).
test('with the Magician alive, Lil’ Monsta’s Is The Demon on a non-Minion warns', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Babysitting Magician', [
		'lilmonsta',
		'magician',
		'poisoner',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Magician');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Chef');
	await putReminder(page, 'Is The Demon', 3);
	await expect(page.getByText(/a jinx says who carries it/)).toBeVisible();
	await expect(await openSeat(page, 3)).toContainText('Is The Demon');
});

// Lil' Monsta is never dealt, yet its step is in the walk-through (M41). With the Magician
// alive it says the Storyteller picks the babysitter
// (https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes); with the Poppy Grower alive,
// that the Minions wake one at a time
// (https://wiki.bloodontheclocktower.com/Poppy_Grower#Related_Jinxes).
for (const { partner, name, says } of [
	{
		partner: 'magician',
		name: 'Magician',
		says: /Storyteller\s+chooses which Minion takes the\s*Lil. Monsta\s*token/
	},
	{
		partner: 'poppygrower',
		name: 'Poppy Grower',
		says: /Minions wake one at a time, until one chooses to take the\s*Lil. Monsta\s*token/
	}
])
	test(`Lil’ Monsta’s step says how its babysitter is chosen with the ${name}`, async ({
		page
	}) => {
		test.slow();
		await startGame(page, `Babysitting ${name}`, [
			'lilmonsta',
			partner,
			'poisoner',
			'chef',
			'empath',
			'monk'
		]);
		await choose(page, 1, name);
		await choose(page, 2, 'Poisoner');
		await choose(page, 3, 'Chef');
		const step = await openStep(page, "Lil' Monsta");
		await expect(step.getByTestId('night-alerts')).toContainText(says);
	});

// The Ogre whose Friend is the Recluse, registering as evil, learns they are evil (M41,
// https://wiki.bloodontheclocktower.com/Ogre#Related_Jinxes).
test('the Ogre made evil by the Recluse learns they are evil', async ({ page }) => {
	test.slow();
	await startGame(page, 'Ogre Recluse', ['ogre', 'recluse', 'imp', 'chef', 'empath', 'monk']);
	await choose(page, 1, 'Ogre');
	await choose(page, 2, 'Recluse');
	await choose(page, 3, 'Imp');
	await putReminder(page, 'Friend', 2);
	const ask = page.getByRole('alertdialog', { name: 'Make this player evil?' });
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await closeBin(page);
	const step = await openStep(page, 'Ogre');
	await expect(step.getByTestId('night-alerts')).toContainText(/learns they are evil/);
});

// At the tea party a Demon who chooses Lil' Monsta also chooses a Minion, and becomes that
// (L116, https://wiki.bloodontheclocktower.com/Hatter#Related_Jinxes).
test('the Hatter’s Demon who chooses Lil’ Monsta also chooses a Minion to become', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Babysitting Hatter', [
		'hatter',
		'lilmonsta',
		'imp',
		'poisoner',
		'spy',
		'chef',
		'empath'
	]);
	await choose(page, 1, 'Hatter');
	await choose(page, 2, 'Chef');
	await choose(page, 3, 'Poisoner');
	await choose(page, 4, 'Imp');
	await toSecondNight(page, 1);

	const step = await openStep(page, 'Hatter');
	await expect(step.getByTestId('also-becomes')).toContainText('also chooses a Minion to become');
	const change = step.getByTestId('change-character');
	await change.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Changes character' })
		.getByRole('button', { name: /Seat 4/ })
		.tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: "Lil' Monsta", exact: true })
		.tap();
	const minions = page.getByRole('dialog', { name: 'Also choose a Minion' });
	await expect(minions.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0);
	await minions.getByRole('button', { name: 'Spy', exact: true }).tap();
	await expect(change).toContainText('Spy');
	await step.getByRole('button', { name: 'Close' }).first().tap();
	await expect(await openSeat(page, 4)).toContainText(/Minion · Evil · Seat 4[\s\S]*Spy/);
});

// Legion's jinxes (L117, https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes): the
// Engineer with Legion in play learns on the first night they have no ability.
test('the Engineer with Legion in play learns they have no ability', async ({ page }) => {
	test.slow();
	await startGame(page, 'Legion Engineer', [
		'legion',
		'engineer',
		'chef',
		'empath',
		'monk',
		'soldier',
		'imp'
	]);
	await choose(page, 1, 'Legion');
	await choose(page, 2, 'Legion');
	await choose(page, 3, 'Engineer');
	await choose(page, 4, 'Chef');

	const step = await openStep(page, 'Engineer');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/Engineer\s*,\s*learns they have no\s+ability\s*\(\s*Legion\s*\)/
	);
});

// The Engineer who makes Legion makes every evil player Legion, said on the step first.
test('the Engineer who creates Legion makes every evil player Legion', async ({ page }) => {
	test.slow();
	await startGame(page, 'Engineer Legion', [
		'engineer',
		'legion',
		'imp',
		'poisoner',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Engineer');
	await choose(page, 2, 'Imp');
	await choose(page, 3, 'Poisoner');
	await choose(page, 4, 'Chef');

	const step = await openStep(page, 'Engineer');
	await expect(step.getByTestId('all-evil-become')).toContainText(
		/Legion\s*:\s+if\s+created,\s+every\s+evil\s+player\s+becomes\s+it\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Changes character' })
		.getByRole('button', { name: /Imp/ })
		.tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: 'Legion', exact: true })
		.tap();
	const made = step.getByTestId('change-character');
	await expect(made.getByRole('button', { name: 'Show to player' })).toHaveCount(2);
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();
	await expect(await openSeat(page, 3)).toContainText(/Demon · Evil · Seat 3[\s\S]*Legion/);
});

// The Preacher who chooses Legion: Legion keeps their ability, and the Preacher's step says
// the Preacher might learn they are Legion.
test('the Preacher who chooses Legion might learn they are Legion', async ({ page }) => {
	test.slow();
	await startGame(page, 'Legion Preacher', [
		'legion',
		'preacher',
		'chef',
		'empath',
		'monk',
		'soldier',
		'imp'
	]);
	await choose(page, 1, 'Legion');
	await choose(page, 2, 'Legion');
	await choose(page, 3, 'Preacher');
	await choose(page, 4, 'Chef');
	await putReminder(page, 'No Ability', 1);
	await closeBin(page);

	const step = await openStep(page, 'Preacher');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/Preacher\s*,\s*might learn a player\s+is\s*Legion\s*,\s*who keeps their ability/
	);
});

// With the Magician in play, Demon info shows Legion the good players but not the Magician.
test('Demon info with Legion and the Magician shows the good players, not the Magician', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Legion Magician', [
		'legion',
		'magician',
		'chef',
		'empath',
		'monk',
		'soldier',
		'imp'
	]);
	await choose(page, 1, 'Legion');
	await choose(page, 2, 'Legion');
	await choose(page, 3, 'Legion');
	await choose(page, 4, 'Legion');
	await choose(page, 5, 'Magician');
	await choose(page, 6, 'Chef');
	await choose(page, 7, 'Empath');

	const info = await openStep(page, 'Demon info');
	const good = info.locator('[data-testid="evil-info-card"][data-row="good"]');
	await expect(good).toContainText('These players are good');
	await expect(good).toContainText('Seat 6');
	await expect(good).toContainText('Seat 7');
	await expect(good).not.toContainText('Seat 5');
	await expect(good).toContainText(/wake the Demon players in separate groups/);
	const minions = info.locator('[data-testid="evil-info-card"][data-row="minions"]');
	await expect(minions).not.toContainText('Seat 5');
});

// The Summoner's jinxes (L118, https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes):
// with the Courtier, the drunk Summoner's step says the Storyteller has its ability.
test('the drunk Summoner with the Courtier leaves its ability to the Storyteller', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Summoner Courtier', [
		'summoner',
		'courtier',
		'chef',
		'empath',
		'monk',
		'soldier',
		'imp'
	]);
	await choose(page, 1, 'Summoner');
	await choose(page, 2, 'Courtier');
	await choose(page, 3, 'Chef');
	await putReminder(page, 'Drunk 1', 1);
	await closeBin(page);

	const step = await openStep(page, 'Summoner');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/Summoner\s+has\s+no\s+ability,\s+so\s+the\s+Storyteller\s+has\s+it\s+and\s+makes\s+the\s+choice\s*\(\s*Courtier\s*\)/
	);
});

// A summoned Lord of Typhon beside a Minion: their other neighbour becomes an evil Minion.
test('a summoned Lord of Typhon makes their other neighbour an evil Minion', async ({ page }) => {
	test.slow();
	await startGame(page, 'Summoner Typhon', [
		'summoner',
		'lordoftyphon',
		'poisoner',
		'spy',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Summoner');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Chef');
	await choose(page, 4, 'Empath');
	await putRunReminder(page, 'Night 3', 1);
	await closeBin(page);

	const step = await openStep(page, 'Summoner');
	await expect(step.getByTestId('neighbour-becomes')).toContainText(
		/Lord of Typhon\s*:\s+if\s+created,\s+they\s+must\s+neighbour\s+a\s+Minion,\s+and\s+their\s+other\s+neighbour\s+becomes\s+an\s+evil\s+one\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Becomes the Demon' })
		.getByRole('button', { name: /Chef/ })
		.tap();
	await page
		.getByRole('dialog', { name: 'Choose a Demon' })
		.getByRole('button', { name: 'Lord of Typhon', exact: true })
		.tap();
	const minions = page.getByRole('dialog', { name: 'Neighbour becomes a Minion' });
	await expect(minions.getByRole('button', { name: 'Poisoner', exact: true })).toHaveCount(0);
	await minions.getByRole('button', { name: 'Spy', exact: true }).tap();
	await expect(step.getByTestId('change-character')).toContainText('Spy');
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();
	await expect(await openSeat(page, 4)).toContainText(/Minion · Evil · Seat 4[\s\S]*Spy/);
});

// A second living Demon summoned with the Pit-Hag on the script: deaths tonight are arbitrary.
test('the Summoner who makes a second living Demon is told deaths are arbitrary', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Summoner Pit-Hag', [
		'summoner',
		'pithag',
		'imp',
		'fanggu',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Summoner');
	await choose(page, 2, 'Imp');
	await choose(page, 3, 'Chef');
	await putRunReminder(page, 'Night 3', 1);
	await closeBin(page);

	const step = await openStep(page, 'Summoner');
	const line = step.getByTestId('arbitrary-deaths');
	await expect(line).toHaveText(
		/If\s+this\s+makes\s+a\s+second\s+living\s+Demon,\s+deaths\s+tonight\s+are\s+arbitrary\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Becomes the Demon' })
		.getByRole('button', { name: /Chef/ })
		.tap();
	await page
		.getByRole('dialog', { name: 'Choose a Demon' })
		.getByRole('button', { name: 'Fang Gu', exact: true })
		.tap();
	await expect(line).toHaveText(
		/A\s+second\s+living\s+Demon:\s+deaths\s+tonight\s+are\s+arbitrary\./
	);
	await expect(line).toHaveAttribute('role', 'alert');
});

// The Alchemist with the Summoner ability (L121,
// https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes): on Night 3 the gained ability
// runs at the Summoner's step; they choose the Demon, the Storyteller the player.
test('the Alchemist-Summoner chooses the Demon on Night 3, the Storyteller the player', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Alchemist Summoner', [
		'alchemist',
		'summoner',
		'imp',
		'poisoner',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Alchemist');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Chef');
	await choose(page, 4, 'Empath');
	// The Alchemist's Minion ability: its token swapped for the Summoner's, still good.
	const alchemist = await openSeat(page, 1);
	await alchemist.getByRole('button', { name: 'Seat actions' }).tap();
	await page.getByRole('dialog').getByRole('button', { name: 'Gained ability…' }).last().tap();
	await page
		.getByRole('dialog', { name: 'Ability Seat 1 gains' })
		.getByRole('button', { name: 'Summoner', exact: true })
		.tap();
	await expect(alchemist).toContainText(/Minion · Good · Seat 1[\s\S]*Summoner/);
	await closeSheet(page);
	await putRunReminder(page, 'Night 3', 1);
	await closeBin(page);

	const step = await openStep(page, 'Summoner');
	await expect(step.getByTestId('picks-character-only')).toContainText(
		/Alchemist\s+has\s+this\s+ability:\s+they\s+choose\s+only\s+the\s+character,\s+the\s+Storyteller\s+chooses\s+which\s+player\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Becomes the Demon' })
		.getByRole('button', { name: /Chef/ })
		.tap();
	await page
		.getByRole('dialog', { name: 'Choose a Demon' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await expect(step.getByTestId('change-character')).toContainText('Imp');
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();
	await expect(await openSeat(page, 3)).toContainText(/Demon · Evil · Seat 3[\s\S]*Imp/);
});

// On its Night 2 the Summoner may make only a Pukka; with the Poppy Grower alive the
// Storyteller chooses the player.
test('the Summoner may summon only a Pukka a night early', async ({ page }) => {
	test.slow();
	await startGame(page, 'Summoner Pukka', [
		'summoner',
		'pukka',
		'imp',
		'poppygrower',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Summoner');
	await choose(page, 2, 'Poppy Grower');
	await choose(page, 3, 'Chef');
	await putRunReminder(page, 'Night 2', 1);
	await closeBin(page);

	const step = await openStep(page, 'Summoner');
	await expect(step.getByTestId('early-only')).toContainText(
		/Tonight\s+only\s*Pukka\s*may\s+be\s+made,\s+a\s+night\s+early\./
	);
	await expect(step.getByTestId('storyteller-picks-now')).toContainText(
		/Poppy Grower\s+is\s+alive:\s+the\s+Storyteller\s+chooses\s+which\s+player,\s+only\s+the\s+character\s+is\s+chosen\s+here\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Becomes the Demon' })
		.getByRole('button', { name: /Chef/ })
		.tap();
	const demons = page.getByRole('dialog', { name: 'Choose a Demon' });
	await expect(demons.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0);
	await demons.getByRole('button', { name: 'Pukka', exact: true }).tap();
	await expect(step.getByTestId('change-character')).toContainText('Pukka');
});

// The Engineer who changes the living Summoner gives the Storyteller the Summoner ability.
test('the Engineer who removes the Summoner gives the Storyteller its ability', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Summoner Engineer', [
		'summoner',
		'engineer',
		'poisoner',
		'imp',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Summoner');
	await choose(page, 2, 'Engineer');
	await choose(page, 3, 'Chef');

	const step = await openStep(page, 'Engineer');
	await expect(step.getByTestId('storyteller-gains')).toContainText(
		/Summoner\s*:\s+if\s+its\s+living\s+player\s+changes\s+character,\s+the\s+Storyteller\s+has\s+its\s+ability\./
	);
	await step.getByTestId('change-character').getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Changes character' })
		.getByRole('button', { name: /Summoner/ })
		.tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: 'Poisoner', exact: true })
		.tap();
	await expect(step.getByTestId('change-character')).toContainText('Poisoner');
	await page.keyboard.press('Escape');
	await expect(step).toBeHidden();
	// The Summoner's step, now the Storyteller's: before the Engineer's on the first night.
	const strip = page.getByTestId('night-strip');
	const name = strip.locator('.step .name strong');
	const back = strip.getByRole('button', { name: 'Previous step' });
	for (let i = 0; i < 10 && (await name.textContent()) !== 'Summoner'; i++) await back.tap();
	await expect(name).toHaveText('Summoner');
	await strip.locator('.row .ring-main, button.step .name:not(.visually-hidden) strong').tap();
	const summoner = nightStep(page, 'Summoner');
	await expect(summoner.getByTestId('step-who')).toHaveText('Storyteller');
});

// The Alchemist's and the remaining one-off jinxes (L119). The Cerenovus may make a player mad
// that they are the Goblin (https://wiki.bloodontheclocktower.com/Cerenovus#Related_Jinxes).
test('the Cerenovus step says a player may be made mad as the Goblin', async ({ page }) => {
	test.slow();
	await startGame(page, 'Cerenovus Goblin', [
		'cerenovus',
		'goblin',
		'chef',
		'empath',
		'monk',
		'soldier',
		'imp'
	]);
	await choose(page, 1, 'Cerenovus');
	await choose(page, 2, 'Chef');
	await choose(page, 3, 'Imp');

	const step = await openStep(page, 'Cerenovus');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/Cerenovus\s*,\s*may\s+make\s+a\s+player\s+mad\s+that\s+they\s+are\s+Goblin/
	);
});

// After an execution the living Magician may guess the Wraith; if right, the Demon must choose
// the Wraith tonight (https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes).
test('after an execution the Demon step says a right Wraith guess makes the Demon choose', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Magician Wraith', [
		'magician',
		'wraith',
		'chef',
		'empath',
		'monk',
		'soldier',
		'imp'
	]);
	await choose(page, 1, 'Magician');
	await choose(page, 2, 'Wraith');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Chef');
	await toSecondNight(page, 4);

	const step = await openStep(page, 'Imp');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/Magician\s+may\s+have\s+guessed\s+a\s+living\s+player\s+as\s+Wraith\s+after\s+today's\s+execution;\s+if\s+right,\s+the\s+Demon\s+must\s+choose\s+that\s+player\s+tonight/
	);
});

// While the Magician is alive, the Demon doesn't know which neighbour is the Marionette
// (https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes).
test('Demon info with the Magician alive leaves the Marionette out of the Minions', async ({
	page
}) => {
	test.slow();
	await startGame(page, 'Magician Marionette', [
		'magician',
		'marionette',
		'chef',
		'empath',
		'monk',
		'soldier',
		'washerwoman',
		'imp'
	]);
	// Seven players, so the first night has Demon info.
	await choose(page, 1, 'Imp');
	await choose(page, 2, 'Chef');
	await choose(page, 3, 'Magician');
	await choose(page, 4, 'Empath');
	await choose(page, 5, 'Monk');
	await choose(page, 6, 'Soldier');
	await choose(page, 7, 'Washerwoman');
	await putReminder(page, 'Is The Marionette', 2);
	const ask = page.getByRole('alertdialog');
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await closeBin(page);

	const info = await openStep(page, 'Demon info');
	const minions = info.locator('[data-testid="evil-info-card"][data-row="minions"]');
	await expect(minions).not.toContainText('Seat 2');
	await expect(minions).toContainText(/the\s+Demon\s+doesn’t\s+learn\s+which\s+neighbour/);
});

// A custom script's own jinx (M44): its custom Lamplighter's entry says that if the Widow would
// poison the Lamplighter, the Storyteller chooses another player, so the Widow's first-night step
// says so for the Lamplighter's player. The Lamplighter is invented for this test; the Djinn's
// rule for a pair is the script's own (https://wiki.bloodontheclocktower.com/Djinn).
test('a custom jinx has the Widow step say the Storyteller chooses another player', async ({
	page
}) => {
	test.slow();
	const lamplighter = {
		id: 'lamplighter',
		name: 'Lamplighter',
		team: 'townsfolk',
		ability: 'Each night, choose a player: you learn whether they woke tonight.',
		jinxes: [
			{
				id: 'widow',
				reason:
					'If the Widow would poison the Lamplighter, the Storyteller chooses another player.',
				rules: { storytellerChooses: { who: 'partner', what: 'another-player' } }
			}
		]
	};
	await startGame(page, 'Lamplighter Widow', [
		lamplighter,
		'widow',
		'imp',
		'chef',
		'empath',
		'monk'
	]);
	await choose(page, 1, 'Lamplighter');
	await choose(page, 2, 'Widow');
	await choose(page, 3, 'Imp');
	const step = await openStep(page, 'Widow');
	await expect(step.getByTestId('night-alerts')).toContainText(
		/Lamplighter\s*,\s*if\s*Widow\s*chooses them, the Storyteller chooses another player instead/
	);
});

// M46's general givenInstead: a script's own jinx sends the Plague Doctor's ability for its
// Hexer to up to two players, who each become a Townsfolk instead (the Baron's shape, reused).
// The Hexer is invented for this test; the Djinn's rule for a pair is the script's own
// (https://wiki.bloodontheclocktower.com/Djinn).
test('a custom Plague Doctor jinx makes up to two players Townsfolk instead', async ({ page }) => {
	test.slow();
	const plagueDoctor = {
		id: 'plaguedoctor',
		jinxes: [
			{
				id: 'hexer',
				reason:
					'If the Storyteller would gain the Hexer ability, up to two players become Townsfolk instead.',
				rules: { givenInstead: { instead: 'becomes', type: 'townsfolk', upTo: 2 } }
			}
		]
	};
	const hexer = {
		id: 'hexer',
		name: 'Hexer',
		team: 'minion',
		ability: 'Each night, choose a player: they feel uneasy.'
	};
	await startGame(page, 'Plague Hexer', [
		plagueDoctor,
		hexer,
		'imp',
		'poisoner',
		'chef',
		'empath',
		'monk',
		'saint',
		'soldier'
	]);
	await choose(page, 1, 'Plague Doctor');
	await choose(page, 2, 'Imp');
	await choose(page, 3, 'Poisoner');
	await choose(page, 4, 'Saint');
	await toSecondNight(page, 1);

	const step = await openStep(page, 'Plague Doctor');
	const row = step.getByTestId('storyteller-ability');
	await row.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: "Storyteller's ability" })
		.getByRole('button', { name: 'Hexer', exact: true })
		.tap();
	// A player, then the Townsfolk they become, not in play.
	const seats = page.getByRole('dialog', { name: 'Becomes a Townsfolk' });
	await seats.getByRole('button', { name: /Saint/ }).tap();
	const townsfolk = page.getByRole('dialog', { name: 'Choose a Townsfolk' });
	await expect(townsfolk.getByRole('button', { name: 'Empath', exact: true })).toBeVisible();
	await expect(townsfolk.getByRole('button', { name: 'Saint', exact: true })).toHaveCount(0);
	await townsfolk.getByRole('button', { name: 'Monk', exact: true }).tap();
	await expect(townsfolk).toBeHidden();
	const given = step.getByTestId('given-instead');
	await expect(given).toContainText('Monk');
	await expect(given).toContainText('Seat 4');
	await expect(step.getByTestId('given-instead-note')).toContainText(
		/Up\s+to\s+two\s+players\s+become\s+Townsfolk\s+instead\./
	);
	// One more may become one.
	await given.getByRole('button', { name: 'Choose' }).tap();
	await seats.getByRole('button', { name: /Poisoner/ }).tap();
	await townsfolk.getByRole('button', { name: 'Chef', exact: true }).tap();
	await expect(given).toContainText('Chef');
	await expect(given.getByRole('button', { name: 'Choose' })).toHaveCount(0);
	// Nothing on the board for the Storyteller.
	await expect(page.getByTestId('storyteller-ability-token')).toHaveCount(0);
});
