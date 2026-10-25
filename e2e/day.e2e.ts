import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

// Spike: the day log and the night answers it feeds (/spikes/day), touch only.

async function loaded(page: Page) {
	await page.goto('/spikes/day');
	await expect(page.getByTestId('day-toolbar')).toBeVisible();
}

async function sampleGame(page: Page, name: 'Sects & Violets' | 'Trouble Brewing' | 'Assorted') {
	await page.getByRole('combobox', { name: 'Sample game' }).tap();
	await page.getByRole('option', { name, exact: true }).tap();
}

/** Walks the night one step at a time until the step for `title` is showing. */
async function walkTo(page: Page, title: string): Promise<Locator> {
	const step = page.getByRole('article', { name: `Night step: ${title}` });
	for (let i = 0; i < 30 && !(await step.isVisible()); i++) {
		await page.getByRole('button', { name: 'Next' }).tap();
	}
	await expect(step).toBeVisible();
	return step;
}

/** Where an element sits on the page (not the viewport, which scrolls on tap). */
const place = (locator: Locator) =>
	locator.evaluate((el) => {
		const r = el.getBoundingClientRect();
		return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
	});

test('Demon voted feeds the Flowergirl, and there is no New day button', async ({ page }) => {
	await loaded(page);
	// Nominations happen off the grimoire, so there is nothing to tap for them.
	await expect(page.getByRole('radiogroup', { name: 'Tapping a player' })).toHaveCount(0);

	// One tap on the Flowergirl's own row (Trevor, 2026-10-23: L43), pressed until tapped again.
	await expect(page.getByTestId('day-toolbar').getByTestId('demon-voted')).toHaveCount(0);
	const voted = page
		.locator('li[data-character="flowergirl"]')
		.getByRole('button', { name: 'Demon voted' });
	await voted.tap();
	// It asks first, showing the token that swaps on her seat (Trevor, 2026-10-24).
	const confirm = page.getByRole('alertdialog', { name: 'Demon voted' });
	await expect(confirm).toContainText('Mark that the Demon voted today?');
	await expect(confirm).toContainText('Not marked yet today.');
	await expect(confirm.getByTestId('reminder-token')).toHaveText('Demon Voted');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(voted).toHaveAttribute('aria-pressed', 'true');
	// The Town Crier has the same button for whether a Minion nominated.
	await expect(
		page.locator('li[data-character="towncrier"]').getByRole('button', { name: 'Minion nominated' })
	).toHaveAttribute('aria-pressed', 'false');
	await expect(
		page.getByRole('checkbox', { name: 'Demon voted', includeHidden: true })
	).toHaveCount(0);
	await page.getByRole('button', { name: 'Night order', exact: true }).tap();
	const flowergirl = await walkTo(page, 'Flowergirl');
	await expect(flowergirl.getByRole('group', { name: 'Flowergirl answer' })).toContainText(
		'Yes: the Demon Fay (Fang Gu) voted'
	);

	// A new day starts when the night ends, not from a button here (Trevor, 2026-10-16).
	await page.getByRole('button', { name: 'Back to day' }).tap();
	await expect(page.getByRole('button', { name: 'New day' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('the Slayer is marked Used and unmarked after a confirm each, and the Washerwoman picks her info', async ({
	page
}) => {
	await loaded(page);
	await sampleGame(page, 'Trouble Brewing');
	const used = page.getByRole('button', { name: 'Used: Slayer (Ben)' });
	const before = await place(used);
	await used.tap();
	const confirm = page.getByRole('alertdialog', { name: /^Mark Slayer \(\s?Ben\s?\) as used\?$/ });
	await expect(confirm).toContainText('Slayer (Ben) has not used their ability.');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(used).toHaveAttribute('aria-pressed', 'true');
	// The reminder stays where it was, pressed, so the list does not jump.
	expect(await place(used)).toEqual(before);
	// Tapping it again unmarks it, after its own confirm (Trevor, 2026-10-17).
	await used.tap();
	const undo = page.getByRole('alertdialog', { name: /^Mark Slayer \(\s?Ben\s?\) as not used\?$/ });
	await expect(undo).toContainText('has used their ability and has the No Ability reminder.');
	await undo.getByRole('button', { name: 'Confirm' }).tap();
	await expect(used).toHaveAttribute('aria-pressed', 'false');
	await expect(undo).toBeHidden();
	await used.tap();
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(used).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('button', { name: 'Night order', exact: true }).tap();
	await page.getByRole('combobox', { name: 'Which night' }).tap();
	await page.getByRole('option', { name: 'First', exact: true }).tap();
	const step = await walkTo(page, 'Washerwoman');
	await step.getByRole('button', { name: 'Pick info for Ana' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Washerwoman · Ana' });
	await expect(sheet).toBeVisible();
	const players = sheet.getByRole('group', { name: 'Players' });
	// Truthful players come first: Ben (Slayer) leads.
	await expect(players.getByRole('button').first()).toHaveText('Ben');
	await expect(players.getByRole('button', { name: 'Ben' })).toHaveAttribute(
		'data-truthful',
		'true'
	);
	await players.getByRole('button', { name: 'Ben' }).tap();
	await players.getByRole('button', { name: 'Gus' }).tap();
	await sheet
		.getByRole('group', { name: 'Characters' })
		.getByRole('button', { name: 'Slayer' })
		.tap();
	await expect(sheet.getByTestId('info-verdict')).toHaveText('True.');
	await sheet.getByRole('button', { name: 'Record' }).tap();
	await expect(sheet).toBeHidden();
	await expect(step.getByTestId('info-shown')).toHaveText(
		'Recorded: Shown Ben and Gus: one is the Slayer'
	);
});

test("day notes are gone; a player's day button sits in their ability row", async ({ page }) => {
	// Trevor, 2026-10-19: no notes in the day view, and the buttons beside each player (B);
	// the Players section is gone and the button sits on the ability row (Trevor, 2026-10-20).
	await loaded(page);
	await sampleGame(page, 'Trouble Brewing');
	await expect(page.getByRole('button', { name: /^Note: / })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Players' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Seat: / })).toHaveCount(0);
	const button = page.getByRole('button', { name: 'Used: Slayer (Ben)' });
	await expect(button).toHaveCount(1);
	const row = page.locator('li[data-character="slayer"]').filter({ has: button });
	await expect(row).toHaveCount(1);
	// The character's band across the row, the ability under it, then a strip joined below
	// with the state and the button at its end (Trevor, 2026-10-23).
	const band = row.locator('.bar .badge');
	await expect(band).toContainText('Slayer');
	// The player's name badge inside the character's (Trevor, 2026-10-24).
	await expect(band.getByTestId('player-badge')).toHaveText('Ben');
	const bar = await place(row.locator('.bar'));
	const ability = await place(row.locator('.ability'));
	const footer = await place(row.locator('.footer'));
	const used = await place(button);
	expect(ability.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
	expect(footer.y).toBeGreaterThanOrEqual(ability.y + ability.height - 1);
	expect(used.y).toBeGreaterThanOrEqual(footer.y - 1);
	expect(used.x + used.width).toBeGreaterThan(footer.x + footer.width * 0.6);
	// The button is the strip's square end, its full height, and the state reads at the
	// ability's size (Trevor, 2026-10-24: option A).
	expect(Math.abs(used.x + used.width - (footer.x + footer.width))).toBeLessThan(2);
	expect(used.height).toBeGreaterThanOrEqual(footer.height - 2);
	await expect(button).toHaveCSS('border-top-left-radius', '0px');
	const size = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize);
	expect(await size(row.getByTestId('day-state'))).toBe(await size(row.locator('.ability')));
	await row.screenshot({ path: `test-results/day-used-row-${test.info().project.name}.png` });
});

test("the Juggler's note has 5 guess slots, and a player may be guessed twice", async ({
	page
}) => {
	await loaded(page);
	await sampleGame(page, 'Sects & Violets');
	// His guesses have their own button on his row (Trevor, 2026-10-19).
	await expect(
		page.locator('li[data-character="juggler"]').getByRole('button', { name: /^Guesses: Juggler/ })
	).toHaveCount(1);
	await page.getByRole('button', { name: /^Guesses: Juggler/ }).tap();
	const sheet = page.getByRole('dialog', { name: /^Note: Juggler/ });
	// Up to 5 guesses, each a player and a character (https://wiki.bloodontheclocktower.com/Juggler;
	// Trevor, 2026-10-24: free slots, not one per player).
	await expect(sheet.getByTestId('guess-slot')).toHaveCount(5);
	const pick = async (name: string, option: string) => {
		await sheet.getByRole('combobox', { name }).tap();
		await page.getByRole('option', { name: option, exact: true }).tap();
	};
	const correct = sheet.getByTestId('correct-guesses');
	await expect(sheet.getByRole('combobox', { name: 'Character for guess 1' })).toHaveText(
		'No guess'
	);
	// Eve is the Witch: guessing her as the Cerenovus and then the Witch is one right of two.
	await pick('Player for guess 1', 'Eve');
	await pick('Character for guess 1', 'Cerenovus');
	await expect(correct).toHaveText('0 correct');
	await pick('Player for guess 2', 'Eve');
	await pick('Character for guess 2', 'Witch');
	await expect(correct).toHaveText('1 correct');
	await sheet.getByRole('button', { name: 'Confirm' }).tap();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: /^Guesses: Juggler/ }).tap();
	await expect(sheet.getByRole('combobox', { name: 'Player for guess 2' })).toHaveText('Eve');
	await expect(sheet.getByRole('combobox', { name: 'Character for guess 2' })).toHaveText('Witch');
	await expect(sheet.getByTestId('guess-slot')).toHaveCount(5);
	await sheet.screenshot({ path: `test-results/juggler-slots-${test.info().project.name}.png` });
});

test('the Gossip’s statement, marked true, is a yes on her night step (L58)', async ({ page }) => {
	// https://wiki.bloodontheclocktower.com/Gossip: a true public statement means a death tonight.
	await loaded(page);
	await sampleGame(page, 'Sects & Violets');
	const button = page
		.locator('li[data-character="gossip"]')
		.getByRole('button', { name: /^Statement: Gossip/ });
	await expect(button).toHaveCount(1);
	await button.tap();
	const sheet = page.getByRole('dialog', { name: /^Note: Gossip/ });
	await sheet.getByRole('textbox', { name: 'Statement' }).fill('Fay is the Demon');
	await sheet.getByText('The statement is true', { exact: true }).tap();
	await sheet.getByRole('button', { name: 'Confirm' }).tap();
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: 'Night order', exact: true }).tap();
	const gossip = await walkTo(page, 'Gossip');
	await expect(gossip.getByRole('group', { name: 'Gossip answer' })).toContainText('Yes');
});

test('with help switched off the night is a checklist with no worked-out answers', async ({
	page
}) => {
	await loaded(page);
	await openSettingsDialog(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller', exact: true })
		.tap();
	for (const name of ['Walk me through the night', 'Work out night answers', 'Pre-day reminders']) {
		await settings.getByText(name, { exact: true }).tap();
	}
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	// Pre-day reminders are off, but Abilities lists every player with a character, with
	// their day button on their row (Trevor, 2026-10-20).
	await expect(page.getByRole('heading', { name: 'Abilities' })).toBeVisible();
	const abilities = page
		.locator('.collapsible')
		.filter({ has: page.getByRole('heading', { name: 'Abilities' }) });
	await expect(abilities.locator('> .body li')).toHaveCount(8);
	await expect(abilities).toContainText('Eve');
	await expect(
		abilities.locator('li[data-character="juggler"]').getByRole('button', { name: /^Guesses: / })
	).toBeVisible();

	await page.getByRole('button', { name: 'Night order', exact: true }).tap();
	const checklist = page.getByTestId('night-checklist');
	await expect(checklist).toBeVisible();
	await expect(page.getByTestId('night-walkthrough')).toHaveCount(0);
	await expect(checklist.locator('[data-step="towncrier"]')).toBeVisible();
	await expect(page.getByRole('group', { name: 'Town Crier answer' })).toHaveCount(0);
});

test('impaired abilities, registration ranges, the Mathematician and a Gambler death', async ({
	page
}) => {
	await loaded(page);
	await sampleGame(page, 'Assorted');
	// Ana starts the day alive.
	const anaRow = page
		.getByTestId('count-table')
		.locator('tr[data-seat]')
		.filter({ hasText: 'Ana' });
	await page.getByTestId('alive-count').tap();
	await expect(anaRow).toHaveCount(1);
	await expect(anaRow).not.toContainText('Dead');
	await page.getByRole('dialog').last().getByRole('button', { name: 'Close' }).tap();
	await expect(anaRow).toBeHidden();
	// The Preacher (Gus) chose the Poisoner (Dev): one line, naming the Preacher.
	const poisoner = page.locator('li[data-character="poisoner"]');
	await expect(poisoner).toHaveCount(1);
	await expect(poisoner).toContainText('Has no ability');
	await expect(poisoner).toContainText(/Preacher\s*Gus/);

	await page.getByRole('button', { name: 'Night order', exact: true }).tap();
	await page.getByRole('combobox', { name: 'Which night' }).tap();
	await page.getByRole('option', { name: 'First', exact: true }).tap();
	const dev = await walkTo(page, 'Poisoner');
	await expect(dev.getByTestId('step-impaired')).toHaveText('Dev · No Ability · Gus (Preacher)');

	// Cat the Recluse sits next to the Poisoner and the Imp: 1 pair, or 2 if evil.
	const chef = await walkTo(page, 'Chef');
	await expect(chef.getByTestId('info-range')).toHaveText('1 (1 / 2)');
	await chef.getByRole('button', { name: 'Pick info for Ben' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Chef · Ben' });
	await sheet.getByRole('group', { name: 'Number' }).getByRole('button', { name: '2' }).tap();
	await expect(sheet.getByTestId('info-verdict')).toContainText('Might register falsely: Cat');
	await sheet.getByRole('button', { name: 'Record' }).tap();
	await expect(sheet).toBeHidden();

	const mathematician = await walkTo(page, 'Mathematician');
	await expect(mathematician.getByRole('group', { name: 'Mathematician answer' })).toContainText(
		'Show 1: Ben (Chef)'
	);

	await page.getByRole('combobox', { name: 'Which night' }).tap();
	await page.getByRole('option', { name: 'Others', exact: true }).tap();
	const gambler = await walkTo(page, 'Gambler');
	await gambler.getByRole('button', { name: 'Pick for Ana' }).tap();
	const choice = page.getByRole('dialog', { name: 'Gambler · Ana' });
	await choice.getByRole('group', { name: 'Players' }).getByRole('button', { name: 'Ben' }).tap();
	await choice
		.getByRole('group', { name: 'Characters' })
		.getByRole('button', { name: 'Imp' })
		.tap();
	await expect(choice.getByTestId('death-verdict')).toHaveText('Dead: Ana');
	await choice.getByRole('button', { name: 'Dead: Ana' }).tap();
	await expect(choice).toBeHidden();

	await page.getByRole('button', { name: 'Back to day' }).tap();
	// Ana is counted dead in the day view's living players.
	await page.getByTestId('alive-count').tap();
	await expect(anaRow).toContainText('Dead');
});

test('character rows read as one list split by dividers', async ({ page }) => {
	await loaded(page);
	// No boxes with the background showing between them (Trevor, 2026-10-23: L44).
	const list = page
		.locator('ul.rows')
		.filter({ has: page.locator('li + li') })
		.first();
	const rows = list.locator(':scope > li');
	const first = await place(rows.nth(0));
	const second = await place(rows.nth(1));
	expect(second.y - (first.y + first.height)).toBeLessThan(1);
	await expect(rows.nth(1)).toHaveCSS('border-top-style', 'solid');
});
