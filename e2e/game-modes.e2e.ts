import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseRulesOnSetup, pickScript, toBoard } from './new-game.ts';
import { expectMatchingIconRow } from './icon-row.ts';
import { openSettingsDialog } from './shell.ts';
import { savesSettled, trackSaves } from './saves.ts';

/**
 * Game modes on New game (Trevor, 2026-10-17): choose a mode, inspect every part of it, and
 * restrict characters. Whale Buffet's rules: https://whalebuffet.com/.
 */
const modesPanel = (page: Page) => page.getByRole('main');

/**
 * Game modes are picked on New game from one drop-down, Standard first (Trevor, 2026-10-18).
 */
async function chooseMode(page: Page, name: string) {
	const modes = modesPanel(page).getByRole('combobox', { name: 'Game mode' });
	await modes.tap();
	await page.getByRole('option', { name, exact: true }).tap();
	await expect(modes).toContainText(name);
}

/**
 * Special rules stack on any mode (Trevor, 2026-10-18): a mode that opens on its draft still
 * switches them on from New game; every other game does on Character selection (2026-10-29).
 */
async function chooseRules(page: Page, ...names: string[]) {
	await modesPanel(page)
		.getByRole('button', { name: /^Special rules/ })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	// The list, not the conflicts at the top, which repeat a rule's switch.
	const list = dialog.getByTestId('special-rules');
	for (const name of names) {
		await list.getByText(name, { exact: true }).tap();
		await expect(list.getByRole('checkbox', { name, includeHidden: true })).toBeChecked();
	}
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await expect(modesPanel(page).getByRole('button', { name: /^Special rules/ })).toHaveText(
		`Special rules ${names.length}`
	);
}

/** Character selection's Special rules sheet for a new Standard game (Trevor, 2026-10-29). */
async function openRulesOnSetup(page: Page) {
	await page.goto('/new');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByTestId('setup-special-rules').tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('New game is one screen: Standard by default, a mode fills in its About and settings', async ({
	page
}) => {
	await page.goto('/new');
	const mode = modesPanel(page).getByRole('combobox', { name: 'Game mode' });
	await expect(mode).toContainText('Standard');
	await expect(page.getByRole('tab')).toHaveCount(0);
	// Standard has its About too, crediting The Pandemonium Institute (Trevor, 2026-10-18).
	await expect(page.getByTestId('inspect-authors')).toHaveText('The Pandemonium Institute');
	// Trevor's own wording (2026-10-19), so it shows without our own wording on.
	await expect(page.getByTestId('inspect-about')).toHaveText(
		'Normal rules for Blood on the Clocktower'
	);
	// Standard's count is Character selection's (Trevor, 2026-10-28); a mode keeps its own.
	await expect(page.getByTestId('player-count')).toHaveCount(0);
	// Game mode, About and Script share the page's one section header (Trevor, 2026-10-19).
	const headings = (names: string[]) =>
		Promise.all(
			names.map((name) =>
				expect(modesPanel(page).getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
			)
		);
	await headings(['Game mode', 'About', 'Script']);
	await chooseMode(page, 'Whale Buffet');
	await expect(page.getByTestId('mode-about')).toBeVisible();
	await expect(page.getByTestId('player-count')).toHaveCount(1);
	await headings(['Game mode', 'About', 'Game mode settings', 'Script']);
	await chooseMode(page, 'Standard');
	await expect(page.getByTestId('inspect-authors')).toHaveText('The Pandemonium Institute');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
});

test('a mode’s own settings sit under Game mode settings, each with its description', async ({
	page
}) => {
	// Trevor, 2026-10-19: a Game mode settings header beneath About and before the setup sheet,
	// holding every mode setting (Role Recycling, Restricted characters), each described.
	await page.goto('/new');
	await expect(page.getByTestId('mode-settings')).toHaveCount(0);
	await chooseMode(page, 'Sushi Buffet');
	const settings = page.getByTestId('mode-settings');
	await expect(settings.getByRole('heading', { name: 'Game mode settings' })).toBeVisible();
	await expect(settings.getByRole('checkbox', { name: 'Role Recycling' })).toBeVisible();
	// A setting is on or off, so its description says what it does (Trevor, 2026-10-19).
	await expect(settings).toContainText(
		'Declined characters return to character pool for future players.'
	);
	await expect(settings.getByRole('button', { name: /^Restricted characters/ })).toBeVisible();
	await expect(settings).toContainText('Characters kept out of this game.');
	// Above the setup sheet.
	const sheet = modesPanel(page).getByTestId('player-count');
	const [a, b] = await Promise.all([settings.boundingBox(), sheet.boundingBox()]);
	expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
});

test('Inspect shows every part of a mode with its status and the mode file', async ({ page }) => {
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	await page.getByRole('button', { name: 'Inspect Whale Buffet' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Whale Buffet' });
	await expect(dialog.getByRole('link', { name: 'Whalebuffet', exact: true })).toHaveAttribute(
		'href',
		'https://whalebuffet.com/'
	);
	const banned = dialog.locator('[data-part="restricted"]');
	await expect(banned).toContainText('Run by the app');
	for (const name of ['Atheist', 'Engineer', 'Pit-Hag'])
		await expect(banned.getByRole('button', { name, exact: true })).toBeVisible();
	await expect(dialog.locator('[data-part="assignment"]')).toContainText('Run by the Storyteller');
	// Built-in Storyteller instructions show once Trevor approves them, as descriptions do
	// (2026-10-19); the line he took out, about who is asked to reconsider, stays hidden.
	await expect(
		dialog.locator('[data-part="assignment"] [data-field="instructions"]')
	).toContainText('You may ask a player to reconsider their choice.');
	await expect(dialog.locator('[data-part="information"] [data-field="instructions"]')).toHaveCount(
		0
	);
	// Only the parts the mode changes, until Changed only is turned off (Trevor, 2026-10-19).
	await expect(dialog.locator('[data-part="towns"]')).toHaveCount(0);
	await dialog.getByText('Changed only', { exact: true }).tap();
	await expect(dialog.locator('[data-part="towns"]')).toContainText('Standard');
	// The mode file starts closed every time (Trevor, 2026-10-18).
	await expect(dialog.locator('pre')).toBeHidden();
	await dialog.getByRole('button', { name: 'Mode file', exact: true }).tap();
	await expect(dialog.locator('pre')).toContainText('"id": "whale-buffet"');
	// JSON is coloured by kind of piece (Trevor, 2026-10-19).
	await expect(dialog.locator('pre .key', { hasText: '"id"' })).toBeVisible();
	await expect(dialog.locator('pre .string', { hasText: '"whale-buffet"' })).toBeVisible();
	// Download sits beside Copy and saves the file under the mode's name.
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		dialog.getByRole('button', { name: 'Download mode file' }).tap()
	]);
	expect(download.suggestedFilename()).toBe('whale-buffet.json');
	// Our own wording is off by default (no authored content, Trevor 2026-10-15); this
	// description shows anyway, since Trevor approved it (2026-10-24).
	await expect(dialog.getByTestId('inspect-about')).toContainText(
		'Every character is on the script'
	);
	// The dialog's content scrolls to its last part (Trevor, 2026-10-18).
	const scroll = dialog.getByTestId('mode-inspect-scroll');
	const sizes = await scroll.evaluate((el) => ({
		scroll: el.scrollHeight,
		client: el.clientHeight
	}));
	expect(sizes.scroll).toBeGreaterThan(sizes.client);
	await scroll.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await noSidewaysScroll(page);
	// The choice is remembered.
	await dialog.getByRole('button', { name: 'Close' }).first().tap();
	await page.getByRole('button', { name: 'Inspect Whale Buffet' }).tap();
	await expect(dialog.locator('[data-part="towns"]')).toContainText('Standard');
});

test('restricted characters stay out of the game, and the mode’s bans can be lifted', async ({
	page
}) => {
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	const restricted = modesPanel(page).getByRole('button', { name: /^Restricted characters/ });
	await expect(restricted.locator('.count-badge')).toHaveText('3');
	await restricted.tap();
	const dialog = page.getByRole('dialog', { name: 'Restricted characters' });
	await dialog.getByRole('searchbox').fill('Pit-Hag');
	await dialog.getByRole('button', { name: /^Pit-Hag/ }).tap();
	await dialog.getByRole('searchbox').fill('Imp');
	await dialog.getByRole('button', { name: /^Imp\b/ }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(restricted.locator('.count-badge')).toHaveText('3');

	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	// Whale Buffet opens on choosing; the setup list shows the game's characters all the same.
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
	await page.goto(new URL(page.url()).pathname.replace(/\/deal$/, '/setup'));
	const list = page.getByTestId('character-picker');
	// Every character is in the pool, less the restricted ones.
	await expect(list.getByRole('button', { name: 'Vortox', exact: true })).toBeVisible();
	await expect(list.getByRole('button', { name: 'Pit-Hag', exact: true })).toBeVisible();
	await expect(list.getByRole('button', { name: 'Imp', exact: true })).toHaveCount(0);
	await expect(list.getByRole('button', { name: 'Atheist', exact: true })).toHaveCount(0);
});

/**
 * Starts a 5-player Trouble Brewing game in `mode`; it opens on the draft or choose screen.
 * `setting`, when given, is a New game switch to turn on first.
 */
async function startIn(page: Page, mode: string, setting?: string) {
	await page.goto('/new');
	await chooseMode(page, mode);
	const panel = modesPanel(page);
	// Whale Buffet plays every character, so it has no script to choose.
	const script = panel.getByRole('radiogroup', { name: 'Script' });
	if (await script.count()) await script.getByText('Trouble Brewing').tap();
	for (let n = 8; n > 5; n--) await panel.getByRole('button', { name: 'Fewer players' }).tap();
	if (setting) await panel.locator('[data-setting]').getByText(setting, { exact: true }).tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
}

const rows = (page: Page) =>
	page.getByTestId('character-picker').locator('button[data-character-id]');

/** The same tile bag as setup's draw (Trevor, 2026-10-18). */
const bagTiles = (page: Page) =>
	page.getByRole('list', { name: 'Bag' }).locator('button[data-state="in-bag"]');

/** A player draws a tile; it opens their offer or dealt type. */
async function drawTile(page: Page) {
	await bagTiles(page).first().tap();
	await expect(rows(page).first()).toBeVisible();
}

/** The player keeps the first character, sees it as in setup's draw and confirms. */
async function keepFirst(page: Page): Promise<string> {
	const first = rows(page).first();
	const id = (await first.getAttribute('data-character-id'))!;
	await first.tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal).toBeVisible();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(reveal).toBeHidden();
	// The Storyteller answers what a drafted character asks, in turn: an Atheist kept as drafted
	// (not the Drunk), an Alchemist's ability later, and the lowest count for a Godfather, Xaan
	// or the like (Legion asks more than one count).
	const asked = page.locator(
		'[data-testid="draft-hidden-choice"], [data-testid="draft-ability"], [data-testid="draft-ask"]'
	);
	const shown = () =>
		asked
			.first()
			.waitFor({ timeout: 1000 })
			.then(
				() => true,
				() => false
			);
	for (let n = 0; n < 6 && (await shown()); n++) {
		const which = await asked.first().getAttribute('data-testid');
		if (which === 'draft-hidden-choice')
			await asked.first().getByRole('button', { name: 'As drafted' }).tap();
		else if (which === 'draft-ability')
			await asked.first().getByRole('button', { name: 'Later' }).tap();
		else await asked.first().getByRole('button').first().tap();
		await expect(page.getByTestId(which!)).toBeHidden();
	}
	// Lil' Monsta turns its player into a Minion: they draft again, offered Minions only.
	if (await page.getByTestId('turned-by').isVisible()) return keepFirst(page);
	return id;
}

const BOARD = /\/grimoire\/[\w-]+(#setup-reminders)?$/;

/**
 * Ends a random draft on the board. A drafted character that turns other players (such as
 * the Lord of Typhon, https://wiki.bloodontheclocktower.com/Lord_of_Typhon) asks first who
 * and what; this picks the first of each, so a random draft can't leave the test on /deal.
 */
async function toBoardAfterDraft(page: Page) {
	const character = page
		.getByTestId('convert-character')
		.locator('.list button[data-character-id]');
	const seat = page.getByTestId('convert-seats').getByRole('listitem');
	const onBoard = () => BOARD.test(page.url());
	for (let n = 0; n < 6; n++) {
		await expect
			.poll(async () => onBoard() || (await character.first().or(seat.first()).isVisible()))
			.toBe(true);
		if (onBoard()) return;
		if (await character.first().isVisible()) await character.first().tap();
		else await seat.first().getByRole('button').first().tap();
	}
	await expect(page).toHaveURL(BOARD);
}

test('Sushi Buffet drafts seat by seat from the tile bag: offers of 3, 2 and 1, then the board', async ({
	page
}) => {
	// https://grimbits.com/draft-buffet/
	await startIn(page, 'Sushi Buffet');
	await expect(page.getByRole('heading', { name: 'Draft', level: 1 })).toBeVisible();
	// No count of seats left (Trevor, 2026-10-18).
	await expect(page.getByTestId('seats-left')).toHaveCount(0);
	// Nothing of the draft on the screen passed round the table (Trevor, 2026-10-19).
	await expect(page.getByRole('group', { name: 'Open slots' })).toHaveCount(0);
	await expect(page.getByText('Setup changes to apply by hand')).toHaveCount(0);
	// No "Next: Seat 1": the draw order is never shown (Trevor, 2026-10-19).
	await expect(page.getByTestId('next-seat')).toHaveCount(0);
	await expect(bagTiles(page)).toHaveCount(5);
	await drawTile(page);
	await expect(rows(page)).toHaveCount(3);
	await page.getByRole('button', { name: 'Refuse offer' }).tap();
	await expect(rows(page)).toHaveCount(2);
	await page.getByRole('button', { name: 'Refuse offer' }).tap();
	await expect(rows(page)).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Refuse offer' })).toBeDisabled();
	const kept: string[] = [];
	for (let seat = 1; seat <= 5; seat++) {
		if (seat > 1) {
			await drawTile(page);
		}
		kept.push(await keepFirst(page));
	}
	expect(new Set(kept).size).toBe(5);
	await expect(bagTiles(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Finish' }).tap();
	// The Drunk is never offered: the Storyteller picks a drafted Townsfolk to be it, or none
	// (https://wiki.bloodontheclocktower.com/Drunk).
	const hidden = page.getByRole('dialog', { name: 'Hidden character' });
	await expect(hidden.getByTestId('draft-hidden')).toBeVisible();
	await hidden.getByRole('button', { name: 'None', exact: true }).tap();
	await toBoardAfterDraft(page);
	await expect(page.getByText('Is The Drunk')).toHaveCount(0);
	await noSidewaysScroll(page);
});

test('Sushi Buffet ends with the Storyteller picking which drafted Townsfolk is the Drunk', async ({
	page
}) => {
	// Grimbits' draft hides the Drunk among drafted Townsfolk (https://grimbits.com/draft-buffet/).
	await startIn(page, 'Sushi Buffet');
	for (let seat = 1; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	await page.getByRole('button', { name: 'Finish' }).tap();
	const hidden = page.getByRole('dialog', { name: 'Hidden character' });
	const seats = hidden.getByTestId('hidden-seats').getByRole('listitem');
	// One row per seat that drafted a Townsfolk, then None.
	await expect(seats.last()).toHaveText('None');
	await seats.first().getByRole('button').first().tap();
	await toBoardAfterDraft(page);
	await expect(page.getByText('Is The Drunk').first()).toBeVisible();
});

// Grimbits' draft (https://grimbits.com/draft-buffet/) lets a drafted Atheist really be the Drunk,
// who thinks they are a Townsfolk (https://wiki.bloodontheclocktower.com/Drunk).
test('Sushi Buffet asks whether a drafted Atheist is really the Drunk', async ({ page }) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	// The held tile's offer is the Atheist.
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const key = `grim-games:mode-deal:v1:${gameId}`;
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = ['atheist'];
		localStorage.setItem(key, JSON.stringify(deal));
	}, key);
	await page.reload();
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await rows(page).first().tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const choice = page.getByRole('dialog', { name: 'Setup change' });
	await expect(choice.getByTestId('draft-hidden-choice')).toBeVisible();
	await expect(choice.getByText('Drunk')).toBeVisible();
	await choice.getByRole('button', { name: 'Really hidden' }).tap();
	await expect(choice).toBeHidden();
	const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	expect(state.hiddenSeats).toEqual({ 0: 'drunk' });
	// No setup change: the game keeps its evil seats.
	expect(state.slots.minion + state.slots.demon).toBeGreaterThan(0);
	for (let seat = 2; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	// The Drunk is placed already, so Finish asks no more.
	await page.getByRole('button', { name: 'Finish' }).tap();
	await toBoardAfterDraft(page);
	await expect(page.getByText('Is The Drunk').first()).toBeVisible();
});

// Grimbits' draft (https://grimbits.com/draft-buffet/) lets a drafted Alchemist take a Minion
// ability that changes setup now (https://wiki.bloodontheclocktower.com/Alchemist): the Baron's
// +2 Outsiders apply (https://wiki.bloodontheclocktower.com/Baron).
test('Sushi Buffet asks which Minion ability a drafted Alchemist has, or later', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const key = `grim-games:mode-deal:v1:${gameId}`;
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = ['alchemist'];
		localStorage.setItem(key, JSON.stringify(deal));
	}, key);
	await page.reload();
	const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await rows(page).first().tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Setup change' });
	const options = dialog.getByTestId('ability-options').getByRole('listitem');
	await expect(options.last()).toHaveText('Later');
	await options.filter({ hasText: 'Baron' }).getByRole('button', { name: 'Has this' }).tap();
	await expect(dialog).toBeHidden();
	const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	expect(state.abilities).toEqual({ 0: 'baron' });
	expect(state.pool).not.toContain('baron');
	expect(state.slots.outsider).toBe(before.slots.outsider + 2);
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): the Marionette keeps a Minion seat out of
// the draft; once the Demon is known, the Storyteller picks a good neighbour of the Demon to be
// it (https://wiki.bloodontheclocktower.com/Marionette).
test('Sushi Buffet with Marionette on: a good neighbour of the Demon is really the Marionette', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet', 'Marionette');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const state = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key)!).state,
		`grim-games:mode-deal:v1:${gameId}`
	);
	// Five players: 3 Townsfolk, 1 Minion and the Demon; the Minion seat is the Marionette's.
	expect(state.reserved).toBe(true);
	expect(state.config.reserve).toEqual({ id: 'marionette', type: 'minion', nextTo: 'demon' });
	expect(state.slots.minion).toBe(0);
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await keepFirst(page);
	for (let seat = 2; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	const drafted = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key)!).state,
		`grim-games:mode-deal:v1:${gameId}`
	);
	// A real Atheist, drafted by chance, leaves no Demon, so no Marionette (its setup change).
	const hasDemon = drafted.picks.some((id: string) => drafted.types[id] === 'demon');
	await page.getByRole('button', { name: 'Finish' }).tap();
	const drunk = page.getByTestId('draft-hidden');
	if (
		await drunk.waitFor({ timeout: 2000 }).then(
			() => true,
			() => false
		)
	)
		await drunk.getByRole('button', { name: 'None', exact: true }).tap();
	if (!hasDemon) {
		await toBoardAfterDraft(page);
		return;
	}
	const reserved = page.getByTestId('reserved-seats').getByRole('listitem');
	await expect(reserved.last()).toHaveText('None');
	// The Demon's two neighbours, then None.
	await expect(reserved).toHaveCount(3);
	await reserved.first().getByRole('button').first().tap();
	await toBoardAfterDraft(page);
	await expect(page.getByText('Is The Marionette').first()).toBeVisible();
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): no Minions are drafted with a Kazali, and
// once everyone has drafted it picks which players are which Minions
// (https://wiki.bloodontheclocktower.com/Kazali).
test('Sushi Buffet ends with a drafted Kazali choosing which players are which Minions', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const key = `grim-games:mode-deal:v1:${gameId}`;
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = ['kazali'];
		localStorage.setItem(key, JSON.stringify(deal));
	}, key);
	await page.reload();
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await keepFirst(page);
	const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	expect(state.slots.minion).toBe(0);
	for (let seat = 2; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	await page.getByRole('button', { name: 'Finish' }).tap();
	const drunk = page.getByTestId('draft-hidden');
	const convert = page.getByTestId('draft-convert');
	await expect(drunk.or(convert)).toBeVisible();
	if (await drunk.isVisible()) await drunk.getByRole('button', { name: 'None', exact: true }).tap();
	// The seats that drafted a good character, then Done; then the Minion for the chosen seat.
	const seats = page.getByTestId('convert-seats').getByRole('listitem');
	await expect(seats.last()).toHaveText('Done');
	await expect(seats).toHaveCount(5);
	await seats.first().getByRole('button').first().tap();
	const minion = page.getByTestId('convert-character').locator('button[data-character-id]').first();
	const name = (await minion.innerText()).split('\n')[0].trim();
	await minion.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
	// The chosen seat is that Minion now.
	await expect(
		page.getByRole('button', { name: new RegExp(`^Seat \\d+: .*${name}$`) })
	).toBeVisible();
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): the Lord of Typhon's neighbours become
// Minions, so the evil players sit in a line with it in the middle
// (https://wiki.bloodontheclocktower.com/Lord_of_Typhon).
test('Sushi Buffet ends with a drafted Lord of Typhon’s two neighbours becoming Minions', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const key = `grim-games:mode-deal:v1:${gameId}`;
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = ['lordoftyphon'];
		localStorage.setItem(key, JSON.stringify(deal));
	}, key);
	await page.reload();
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await keepFirst(page);
	// Its +1 Minion and both Minion seats are its neighbours', so no one drafts a Minion.
	const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	expect(state.slots.minion).toBe(0);
	for (let seat = 2; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	await page.getByRole('button', { name: 'Finish' }).tap();
	const drunk = page.getByTestId('draft-hidden');
	const convert = page.getByTestId('draft-convert');
	await expect(drunk.or(convert)).toBeVisible();
	if (await drunk.isVisible()) await drunk.getByRole('button', { name: 'None', exact: true }).tap();
	// Seat 1 drafted it, so its neighbours are Seats 2 and 5; each picks a Minion from offers,
	// as in the draft (Trevor, 2026-10-27), and may refuse one.
	const pickFrom = page.getByTestId('convert-character');
	const names: string[] = [];
	for (const seat of ['Seat 2', 'Seat 5']) {
		await expect(pickFrom.getByText(seat, { exact: true })).toBeVisible();
		await expect(pickFrom.getByText(/Choose a Minion instead/)).toBeVisible();
		// Not the Lord of Typhon's badge in the prompt.
		const offered = pickFrom.locator('.list button[data-character-id]');
		await expect(offered).toHaveCount(3);
		if (seat === 'Seat 2') {
			await pickFrom.getByRole('button', { name: 'Refuse offer' }).tap();
			await expect(offered).not.toHaveCount(3);
		}
		names.push((await offered.first().innerText()).split('\n')[0].trim());
		await offered.first().tap();
	}
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
	await expect(
		page.getByRole('button', { name: new RegExp(`^Seat 2: .*${names[0]}$`) })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: new RegExp(`^Seat 5: .*${names[1]}$`) })
	).toBeVisible();
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): Lil' Monsta is never dealt, so its player
// becomes a Minion and picks their Minion (https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
test('Sushi Buffet turns the player who drafts Lil’ Monsta into a Minion of their choice', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const key = `grim-games:mode-deal:v1:${gameId}`;
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = ['lilmonsta'];
		localStorage.setItem(key, JSON.stringify(deal));
	}, key);
	await page.reload();
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await rows(page).first().tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	// The same player chooses again, told why, from Minions only.
	await expect(page.getByTestId('turned-by')).toContainText("Lil' Monsta");
	const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	expect(state.picks).toEqual([]);
	expect(state.undealt).toEqual(['lilmonsta']);
	expect(state.slots.demon).toBe(0);
	for (const id of state.offer) expect(state.types[id]).toBe('minion');
	await keepFirst(page);
	const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, key);
	expect(after.picks).toHaveLength(1);
	expect(after.types[after.picks[0]]).toBe('minion');
	for (let seat = 2; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
});

// Trevor (2026-10-26): "modifiers are made dynamically for outsider count", as Grimbits' draft
// does (https://grimbits.com/draft-buffet/, https://wiki.bloodontheclocktower.com/Godfather).
test('Sushi Buffet asks the Storyteller for a drafted Godfather’s Outsiders before the next tile', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await expect(bagTiles(page)).toHaveCount(5);
	// A tile drawn saves the draft on this device.
	await drawTile(page);
	await page.keyboard.press('Escape');
	// The draft as it is just after a player keeps the Godfather: its −1 or +1 waits.
	const gameId = new URL(page.url()).pathname.split('/')[2];
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = [];
		deal.state.pending = [
			{ characterId: 'godfather', op: { kind: 'delta', type: 'outsider', values: [-1, 1] } }
		];
		deal.state.ask = { characterId: 'godfather', type: 'outsider', options: [0, 1], current: 0 };
		localStorage.setItem(key, JSON.stringify(deal));
	}, `grim-games:mode-deal:v1:${gameId}`);
	await page.reload();
	const ask = page.getByRole('dialog', { name: 'Setup change' });
	await expect(ask).toContainText('How many Outsiders in all?');
	await expect(ask.getByText('Godfather')).toBeVisible();
	await ask.getByRole('button', { name: '1', exact: true }).tap();
	await expect(ask).toBeHidden();
	// The held tile opens the next offer.
	await bagTiles(page).first().tap();
	await expect(rows(page)).toHaveCount(3);
});

// Jinxed characters can be drafted together unless the Storyteller says otherwise (Trevor,
// 2026-10-26: "just because a character is jinxed doesn't mean that it cannot be on the script").
test('Sushi Buffet allows jinxed pairs by default', async ({ page }) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const state = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key)!).state,
		`grim-games:mode-deal:v1:${gameId}`
	);
	expect(state.config.jinxes).toBe('allow');
	expect(state.jinxed).toBeUndefined();
});

// Grimbits' Redraft: the Storyteller lets the last player draft again, optionally of one type.
test('Sushi Buffet lets the last player draft again, offered one character type', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	const again = page.getByRole('button', { name: 'Draft again' });
	await expect(again).toBeDisabled();
	await drawTile(page);
	const kept = await keepFirst(page);
	await again.tap();
	const dialog = page.getByTestId('redraft');
	await dialog.getByRole('button', { name: 'Minion', exact: true }).tap();
	await expect(dialog).toBeHidden();
	// Their tile is back with them: it opens the new offer.
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await expect(rows(page).first()).toBeVisible();
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const state = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key)!).state,
		`grim-games:mode-deal:v1:${gameId}`
	);
	expect(state.picks).toEqual([]);
	expect(state.discarded).toContain(kept);
	expect(state.offer.every((id: string) => state.types[id] === 'minion')).toBe(true);
	await expect(again).toBeDisabled();
});

// Grimbits lets the Storyteller reject a drafted Legion, and the player picks again
// (https://grimbits.com/draft-buffet/): any asked setup change can be answered by a redraft.
test('Sushi Buffet can answer a drafted character’s setup change with a redraft', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await keepFirst(page);
	// As if the kept character's Outsider count were asked (a Legion's or a Godfather's).
	const gameId = new URL(page.url()).pathname.split('/')[2];
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = [];
		deal.state.pending = [
			{ characterId: 'godfather', op: { kind: 'delta', type: 'outsider', values: [-1, 1] } }
		];
		deal.state.ask = { characterId: 'godfather', type: 'outsider', options: [0, 1], current: 0 };
		localStorage.setItem(key, JSON.stringify(deal));
	}, `grim-games:mode-deal:v1:${gameId}`);
	await page.reload();
	const ask = page.getByRole('dialog', { name: 'Setup change' });
	await ask.getByRole('button', { name: 'Draft again' }).tap();
	await expect(ask).toBeHidden();
	const state = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key)!).state,
		`grim-games:mode-deal:v1:${gameId}`
	);
	expect(state.ask).toBeUndefined();
	expect(state.picks).toEqual([]);
	expect(state.offer).toHaveLength(3);
});

// Grimbits' draft deals the King once a Choirboy is drafted
// (https://grimbits.com/draft-buffet/, https://wiki.bloodontheclocktower.com/Choirboy).
test('Sushi Buffet offers only the King after a Choirboy, saying why, with no refusing', async ({
	page
}) => {
	await startIn(page, 'Sushi Buffet');
	await drawTile(page);
	await page.keyboard.press('Escape');
	const gameId = new URL(page.url()).pathname.split('/')[2];
	await page.evaluate((key) => {
		const deal = JSON.parse(localStorage.getItem(key)!);
		deal.state.offer = ['king'];
		deal.state.offerIndex = 2;
		deal.state.forcedBy = 'choirboy';
		localStorage.setItem(key, JSON.stringify(deal));
	}, `grim-games:mode-deal:v1:${gameId}`);
	await page.reload();
	await bagTiles(page).first().tap();
	await expect(page.getByTestId('forced-by')).toContainText('Choirboy');
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).first()).toHaveAttribute('data-character-id', 'king');
	await expect(page.getByRole('button', { name: 'Refuse offer' })).toBeDisabled();
});

test('Sushi Buffet with the slot machine on: reels spin in each offer, one more crossed out per refusal', async ({
	page
}) => {
	// Trevor (2026-10-23): the 3-2-1 reel is Sushi Buffet's offers of 3, 2 and 1.
	await page.addInitScript(() =>
		localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ slotMachine: true }))
	);
	await startIn(page, 'Sushi Buffet');
	await bagTiles(page).first().tap();
	const reels = page.getByTestId('offer-reels');
	const crossed = reels.locator('[data-testid="offer-reel"][data-crossed]');
	const refuse = page.getByRole('button', { name: 'Refuse offer' });
	// While the reels spin, the offer's list waits and it can't be refused.
	await expect(reels).toHaveAttribute('data-spinning', '');
	await expect(refuse).toBeDisabled();
	await expect(reels.getByTestId('offer-reel')).toHaveCount(3);
	await expect(crossed).toHaveCount(0);
	await expect(reels).not.toHaveAttribute('data-spinning');
	await expect(rows(page)).toHaveCount(3);
	await expect(rows(page).first()).toBeVisible();
	await refuse.tap();
	await expect(crossed).toHaveCount(1);
	await expect(reels).not.toHaveAttribute('data-spinning');
	await expect(rows(page)).toHaveCount(2);
	await refuse.tap();
	await expect(crossed).toHaveCount(2);
	await expect(reels).not.toHaveAttribute('data-spinning');
	await expect(rows(page)).toHaveCount(1);
	await expect(refuse).toBeDisabled();
	await keepFirst(page);
	await noSidewaysScroll(page);
});

test('Sushi Buffet has no script to choose: it drafts from every official character', async ({
	page
}) => {
	await page.goto('/new');
	await chooseMode(page, 'Sushi Buffet');
	await expect(modesPanel(page).getByRole('radiogroup', { name: 'Script' })).toHaveCount(0);
	// Its About names the source, with Trevor's approved description (2026-10-18).
	const about = modesPanel(page).getByTestId('mode-about');
	await expect(about.getByTestId('inspect-about')).toContainText('three drafted characters');
	await expect(about.locator('a[href="https://grimbits.com/draft-buffet/"]')).toHaveCount(1);
	// The description wraps so it reads whole, never cut off (Trevor, 2026-10-18).
	const description = about.getByTestId('inspect-about');
	expect(await description.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
	await expect(description).toContainText('The demon gets no bluffs.');

	// Role Recycling is the Storyteller's choice (Trevor, 2026-10-18): off by default.
	const recycling = modesPanel(page).getByRole('checkbox', { name: 'Role Recycling' });
	await expect(recycling).not.toBeChecked();
	await modesPanel(page).getByText('Role Recycling').tap();
	await expect(recycling).toBeChecked();
	// Jinxed pairs, as Grimbits' draft tool offers: allowed by default (Trevor, 2026-10-26).
	const jinxed = modesPanel(page).getByRole('combobox', { name: 'Jinxed pairs' });
	await expect(jinxed).toHaveText(/Allow/);
	await jinxed.tap();
	await page.getByRole('option', { name: 'Less likely', exact: true }).tap();
	await expect(jinxed).toHaveText(/Less likely/);
	// Ivory draft, as Grimbits' draft tool offers: off by default.
	const ivory = modesPanel(page).getByRole('checkbox', { name: 'Ivory draft' });
	await expect(ivory).not.toBeChecked();
	await modesPanel(page).getByText('Ivory draft', { exact: true }).tap();
	await expect(ivory).toBeChecked();
	// Don't mix types, as Grimbits' draft tool offers: the mode's own setting (off).
	const oneType = modesPanel(page).getByRole('checkbox', { name: 'Don’t mix types' });
	await expect(oneType).not.toBeChecked();
	await modesPanel(page).getByText('Don’t mix types', { exact: true }).tap();
	await expect(oneType).toBeChecked();
	// Deal needed characters (a Choirboy's King), on by default; Grimbits can turn it off.
	const needed = modesPanel(page).getByRole('checkbox', { name: 'Deal needed characters' });
	await expect(needed).toBeChecked();
	await modesPanel(page).getByText('Deal needed characters', { exact: true }).tap();
	await expect(needed).not.toBeChecked();
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const record = await page.evaluate(
		(id) => JSON.parse(localStorage.getItem(`grim-games:game-mode:v2:${id}`) ?? '{}'),
		gameId
	);
	expect(record.roleRecycling).toBe(true);
	expect(record.jinxedPairs).toBe('reduce');
	expect(record.ivoryDraft).toBe(true);
	expect(record.oneTypePerOffer).toBe(true);
	expect(record.dealsRequired).toBe(false);
	// The draft knows each character's jinxed partners
	// (https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes).
	await drawTile(page);
	await page.keyboard.press('Escape');
	const state = await page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key)!).state,
		`grim-games:mode-deal:v1:${gameId}`
	);
	expect(state.config.jinxes).toBe('reduce');
	expect(state.jinxed.heretic).toContain('baron');
	expect(state.config.ivory).toBe(true);
	expect(state.config.oneTypePerOffer).toBe(true);
	// Offers of 3, then 2, then 1: Trevor (2026-10-26) dropped Grimbits' 3 → 1 option.
	expect(state.config.offers).toEqual([3, 2, 1]);
	expect(state.requires).toBeUndefined();
	// The first offer is all one character type.
	const types = new Set(state.offer.map((id: string) => state.types[id]));
	expect(types.size).toBe(1);
	expect(state.extraEvil).toContain('goon');
});

test('with our own wording on, each mode shows its About description', async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ ownWording: true }))
	);
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	await expect(modesPanel(page).getByTestId('mode-about')).toContainText(
		'Every character is on the script'
	);
	await page.getByRole('button', { name: 'Inspect Whale Buffet' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Whale Buffet' });
	await expect(dialog.getByTestId('inspect-about')).toContainText(
		'Every character is on the script'
	);
	// So do the Storyteller instructions, first in each part the Storyteller runs.
	await expect(dialog.locator('[data-part="assignment"] tr').first()).toContainText(
		'Storyteller instructions'
	);
	await expect(dialog.locator('[data-part="assignment"] tr').first()).toContainText(
		'On the first night each player chooses a character of that type.'
	);
});

test('Whale Buffet deals a type from the tile bag and each player chooses; the Storyteller can ask for a new choice', async ({
	page
}) => {
	// https://whalebuffet.com/
	await startIn(page, 'Whale Buffet');
	await expect(page.getByRole('heading', { name: 'Choose characters', level: 1 })).toBeVisible();
	await drawTile(page);
	await expect(page.getByText(/^Choose a (Townsfolk|Minion|Demon)$/)).toBeVisible();
	await expect(page.locator('button[data-character-id="drunk"]')).toHaveCount(0);
	await keepFirst(page);
	await page.getByRole('button', { name: 'Choose again' }).tap();
	// The tile stays in Seat 1's hand: tapping it reopens their choice.
	await page.getByRole('list', { name: 'Bag' }).locator('button[data-state="held"]').tap();
	await keepFirst(page);
	for (let seat = 2; seat <= 5; seat++) {
		await drawTile(page);
		await keepFirst(page);
	}
	await page.getByRole('button', { name: 'Finish' }).tap();
	await toBoardAfterDraft(page);
});

/** Taps characters in a setup's list. */
async function pick(page: Page, names: readonly string[]) {
	for (const name of names)
		await page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]')).tap();
}

// Trevor, 2026-10-26: one game stops at 20 players; towns sharing their players go to 40.
test('Two games at once takes more than 20 players', async ({ page }) => {
	await page.goto('/new');
	await chooseMode(page, 'Two games at once');
	const more = modesPanel(page).getByRole('button', { name: 'More players' });
	for (let n = 8; n < 21; n++) await more.tap();
	await expect(modesPanel(page).getByTestId('player-count')).toHaveText('21');
	await expect(more).toBeEnabled();
});

test('Two games at once: one setup for both bags, then one token for both games', async ({
	page
}) => {
	// Trevor, 2026-10-17: players play two scripts at once; nobody is the Demon in both.
	// Trevor, 2026-10-18: bag 1, then bag 2, then the draw, with no trip home in between;
	// "The same one token will account for both pulls"; names are typed at the draw.
	await page.goto('/new');
	await chooseMode(page, 'Two games at once');
	const panel = modesPanel(page);
	await panel.getByRole('combobox', { name: 'Town 2 script' }).tap();
	await page.getByRole('option', { name: 'Bad Moon Rising', exact: true }).tap();
	for (let n = 8; n > 5; n--) await panel.getByRole('button', { name: 'Fewer players' }).tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();

	// Town 1's setup opens straight away; its bag opens town 2's setup.
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	const first = page.url();
	await pick(page, ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp']);
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).not.toHaveURL(first);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await expect(page.getByRole('button', { name: 'Grandmother', exact: true })).toBeVisible();
	await pick(page, ['Grandmother', 'Sailor', 'Chambermaid', 'Godfather', 'Zombuul']);
	await page.getByRole('button', { name: 'Build bag' }).tap();

	// The last bag opens a review of both towns' characters, then the draw (Trevor, 2026-10-18).
	await expect(page).toHaveURL(/\/towns\/[\w-]+\/review$/);
	const review = page.getByTestId('review-town');
	await expect(review).toHaveCount(2);
	await expect(review.first()).toContainText('Town 1 · Trouble Brewing');
	for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
		await expect(review.first().getByRole('button', { name, exact: true })).toBeVisible();
	for (const name of ['Grandmother', 'Sailor', 'Chambermaid', 'Godfather', 'Zombuul'])
		await expect(review.nth(1).getByRole('button', { name, exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Edit town 2' })).toBeVisible();
	await noSidewaysScroll(page);
	await page.getByRole('button', { name: 'Draw', exact: true }).tap();
	await expect(page).toHaveURL(/\/towns\/[\w-]+\/draw$/);
	// Back to the review, as one town's Draw goes back to its Characters (Trevor, 2026-10-26).
	await expect(
		page.getByRole('navigation', { name: 'Setup' }).getByRole('link', { name: 'Review characters' })
	).toBeVisible();
	for (let n = 1; n <= 5; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		const reveal = page.getByTestId('reveal');
		// One token, both games' characters.
		await expect(reveal.getByTestId('reveal-face')).toHaveCount(2);
		await expect(reveal).toContainText('Town 1');
		await expect(reveal).toContainText('Town 2');
		if (n === 1) await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
		await page.getByRole('button', { name: 'Confirm' }).tap();
		await expect(reveal).toBeHidden();
	}
	await page.getByRole('link', { name: 'Done' }).tap();
	await expect(page).toHaveURL(/\/towns\/[\w-]+$/);
	const towns = page.url();
	await expect(page.getByTestId('town')).toHaveCount(2);
	await expect(page.getByTestId('town').first()).toContainText('Trouble Brewing');
	await expect(page.getByTestId('town').nth(1)).toContainText('Bad Moon Rising');
	// The draw is random, so one seat may get the Demon in both games: the app warns and
	// never stops it (towns.test.ts covers the warning itself). Names aren't asked up front.
	await expect(page.getByTestId('town-warnings')).toHaveText(
		/Warnings\s*(None|Seat \d+ is a Demon in every town)$/
	);
	await expect(page.getByRole('heading', { name: 'Player names' })).toHaveCount(0);
	// The title keeps its row: Inspect is an icon, so no word breaks (Trevor, 2026-10-18).
	const title = page.getByRole('heading', { name: 'Two games at once', level: 1 });
	const lines = await title.evaluate(
		(el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)
	);
	expect(lines).toBeLessThan(2.5);
	await expect(page.getByRole('button', { name: 'Inspect Two games at once' })).toBeVisible();
	await noSidewaysScroll(page);

	// The name typed at the draw is on both boards. The corner name switches towns.
	await page.getByRole('button', { name: 'Open town 1' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByText('Ana', { exact: true }).first()).toBeVisible();
	const board = page.url();
	await page.getByTestId('mode-menu').tap();
	const menu = page.getByRole('dialog', { name: 'Game info', exact: true });
	await expect(menu.getByRole('button', { name: 'Town 1 · Trouble Brewing' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await menu.getByRole('button', { name: 'Town 2 · Bad Moon Rising' }).tap();
	// Moving between the mode's boards isn't leaving the game, so it never asks (Trevor,
	// 2026-10-19); leaving for anywhere else still does (grimoire.e2e.ts).
	await expect(page).not.toHaveURL(board);
	await expect(page.getByRole('alertdialog', { name: 'Leave the game?' })).toHaveCount(0);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByTestId('script-title')).toContainText('Bad Moon Rising');
	await expect(page.getByText('Ana', { exact: true }).first()).toBeVisible();
	await page.getByTestId('mode-menu').tap();
	await page
		.getByRole('dialog', { name: 'Game info', exact: true })
		.getByRole('button', { name: 'Towns' })
		.tap();
	await expect(page).toHaveURL(towns);
	await expect(page.getByRole('alertdialog', { name: 'Leave the game?' })).toHaveCount(0);
});

test('Two Towns and a Boomdandy starts two towns with their own scripts', async ({ page }) => {
	// https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/
	// The two scripts come from BotC Scripts through our Worker.
	await page.route('**/api/botcscripts/**', async (route) => {
		const zombuul = /6382/.test(route.request().url());
		await route.fulfill({
			json: {
				scriptId: zombuul ? 6382 : 6383,
				versionId: zombuul ? 1 : 2,
				name: zombuul ? 'Zombuul town' : 'Leviathan town',
				version: '1.0.0',
				author: 'Ekin',
				content: [
					{ id: '_meta', name: zombuul ? 'Zombuul town' : 'Leviathan town', author: 'Ekin' },
					'washerwoman',
					'librarian',
					'investigator',
					'chef',
					'mayor',
					'saint',
					'boomdandy',
					'poisoner',
					zombuul ? 'zombuul' : 'leviathan'
				]
			}
		});
	});
	await page.goto('/new');
	await chooseMode(page, 'Two Towns and a Boomdandy');
	const panel = modesPanel(page);
	await expect(panel.getByRole('link', { name: /Zombuul/ })).toBeVisible();
	// Each town sets its own count on its own setup sheet (Trevor, 2026-10-19), split evenly
	// to start; towns further apart than the rules allow warn, and never block.
	await expect(panel.getByTestId('player-count')).toHaveCount(0);
	await expect(panel.getByTestId('town-1-player-count')).toHaveText('5');
	await expect(panel.getByTestId('town-2-player-count')).toHaveText('5');
	await expect(panel.getByRole('heading', { name: 'Town 2 setup sheet' })).toBeVisible();
	const warning = panel.getByTestId('town-sizes-warning');
	const town2 = panel.getByRole('region', { name: 'Town 2 setup sheet' });
	await town2.getByRole('button', { name: 'More players' }).tap();
	await expect(panel.getByTestId('town-2-player-count')).toHaveText('6');
	await expect(warning).toBeHidden();
	await town2.getByRole('button', { name: 'More players' }).tap();
	await expect(warning).toBeVisible();
	await expect(warning).toHaveText('The towns’ player counts differ by more than 1.');
	await town2.getByRole('button', { name: 'Fewer players' }).tap();
	await town2.getByRole('button', { name: 'Fewer players' }).tap();
	await expect(panel.getByTestId('town-2-player-count')).toHaveText('5');
	await expect(panel.getByTestId('town-1-player-count')).toHaveText('5');
	await panel.getByRole('button', { name: 'Create game' }).tap();

	// "Boomdandy and Mayor are guaranteed to be in play": the Boomdandy in the Zombuul town,
	// the Mayor in the other, each already chosen when its setup opens. Town 1's setup opens
	// first, and its bag opens town 2's (Trevor, 2026-10-18).
	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByTestId('count-minion')).toHaveText('1');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	// Required by the mode, so it can't be taken out; its lock is on and says why (Trevor,
	// 2026-10-22).
	const boomdandy = page.locator('.ring-row', {
		has: page.locator('.main[data-character-id="boomdandy"]')
	});
	await boomdandy.locator('.main').tap();
	await expect(boomdandy.locator('.main')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByText('Must be in the bag')).toBeVisible();
	await expect(boomdandy.getByTestId('lock-character')).toHaveAttribute('aria-pressed', 'true');
	// Clear never takes it out, so with only it chosen there is nothing to clear.
	await expect(page.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
	const first = page.url();
	await pick(page, ['Washerwoman', 'Librarian', 'Investigator', 'Zombuul']);
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).not.toHaveURL(first);
	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-minion')).toHaveText('0');
	// The last bag opens the review, and its Draw town 1's draw: each town draws its own players.
	await pick(page, ['Chef', 'Librarian', 'Poisoner', 'Leviathan']);
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/towns\/[\w-]+\/review$/);
	await expect(page.getByTestId('review-town').nth(1)).toContainText('Mayor');
	await page.getByRole('button', { name: 'Draw', exact: true }).tap();
	await expect(page).toHaveURL(first.replace(/\/setup$/, '/draw'));

	const groupId = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:town-groups:v1') ?? '[]')[0]?.groupId
	);
	await page.goto(`/towns/${groupId}`);
	await expect(page.getByTestId('town')).toHaveCount(2);
	await expect(page.getByTestId('town').first()).toContainText('Zombuul town');
	await expect(page.getByTestId('town').nth(1)).toContainText('Leviathan town');
	await expect(page.getByTestId('town-moves')).toHaveText('None before the end of day 1');
	await expect(page.getByRole('button', { name: 'Move a player' })).toBeDisabled();
	await noSidewaysScroll(page);
});

test('a mode file someone wrote can be added, inspected and deleted', async ({ page }) => {
	// Trevor, 2026-10-17: modes are inspectable so people can add their own.
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	const panel = modesPanel(page);
	await expect(panel.getByRole('button', { name: 'Delete Whale Buffet' })).toBeDisabled();
	await panel.getByRole('button', { name: 'Add mode' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Add a game mode' });
	// How to write one (Trevor, 2026-10-18): every part, with the rolling revision.
	await dialog.getByRole('button', { name: 'How to write a mode file' }).tap();
	const guide = page.getByRole('dialog', { name: 'Writing a mode file' });
	await expect(guide.getByTestId('mode-guide-version')).toContainText(/Format 1, revision \d+/);
	// Two panes: the sections listed, the chosen one beside them (Trevor, 2026-10-18); a phone
	// lists them behind Back.
	const sections = guide.getByRole('navigation', { name: 'Sections' });
	if (!(await sections.isVisible()))
		await guide.getByRole('button', { name: 'Sections', exact: true }).tap();
	await expect(sections.getByRole('button')).toHaveCount(18);
	await sections.getByRole('button', { name: 'Character pool', exact: true }).tap();
	await expect(guide.locator('section[data-part="pool"]')).toBeVisible();
	await noSidewaysScroll(page);
	// The whole guide downloads as Markdown or plain text.
	await guide.getByRole('button', { name: 'Download the guide' }).tap();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Markdown (.md)' }).tap()
	]);
	expect(download.suggestedFilename()).toBe('writing-a-mode-file.md');
	await guide.getByRole('button', { name: 'Close' }).first().tap();
	await expect(guide).toBeHidden();
	await dialog.getByTestId('mode-file').fill('{"format": 1, "id": "Bad Id"}');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog.getByRole('status')).toContainText('id: must be lower-case');
	await expect(dialog.getByRole('status')).toContainText('sources: must be a list of links');

	const mine = {
		format: 1,
		revision: 8,
		id: 'tiny-buffet',
		name: 'Tiny Buffet',
		sources: [{ title: 'Our group', url: 'https://example.com/tiny' }],
		parts: {
			pool: { kind: 'all-characters' },
			restricted: { banned: ['pithag'] },
			assignment: { kind: 'choose-own', when: 'first-night', reconsider: false }
		}
	};
	// A part the Storyteller runs says what they do (Trevor, 2026-10-19).
	await dialog.getByTestId('mode-file').fill(JSON.stringify(mine));
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog.getByRole('status')).toContainText(
		'parts.assignment.instructions: the Storyteller runs this part'
	);
	const instructions = 'Each player picks any character of the type they drew.';
	mine.parts.assignment = {
		...mine.parts.assignment,
		instructions
	} as typeof mine.parts.assignment;
	await dialog.getByTestId('mode-file').fill(JSON.stringify(mine));
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog).toHaveCount(0);
	await panel.getByRole('button', { name: 'Inspect Tiny Buffet' }).tap();
	const inspect = page.getByRole('dialog', { name: 'Tiny Buffet' });
	await expect(inspect.locator('[data-part="assignment"] tr').first()).toHaveText(
		`Storyteller instructions${instructions}`
	);
	await inspect.getByRole('button', { name: 'Close' }).first().tap();
	await expect(inspect).toHaveCount(0);
	const modes = panel.getByRole('combobox', { name: 'Game mode' });
	await expect(modes).toContainText('Tiny Buffet');
	await expect(
		panel.getByRole('button', { name: /^Restricted characters/ }).locator('.count-badge')
	).toHaveText('1');

	// It stays on this device.
	await page.reload();
	await chooseMode(page, 'Tiny Buffet');
	await panel.getByRole('button', { name: 'Delete Tiny Buffet' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(modes).not.toContainText('Tiny Buffet');
	await modes.tap();
	await expect(page.getByRole('option', { name: 'Tiny Buffet', exact: true })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await noSidewaysScroll(page);
});

test('A Script of Infinite Possibilities rolls hidden characters from off the script into the selection', async ({
	page
}) => {
	// https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/; Trevor,
	// 2026-10-18: "Any script, with 1-4 hidden extra characters from off the script".
	// A fixed random() keeps every row, so the roll is the same each run.
	await page.addInitScript(() => (Math.random = () => 0.99));
	await page.goto('/new');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'A Script of Infinite Possibilities');
	// Picked on Character selection, no step of their own (Trevor, 2026-10-29).
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await expect(page.getByTestId('setup-off-script')).toContainText('Off the script');
	const extras = page.getByTestId('extras').locator('li');
	// Up to four, one of each type (Trevor, 2026-10-19).
	await expect(extras).toHaveCount(4);
	await expect(extras.nth(0)).toContainText('Townsfolk');
	await expect(extras.nth(1)).toContainText('Outsider');
	await expect(extras.nth(2)).toContainText('Minion');
	await expect(extras.nth(3)).toContainText('Demon');
	// Any range that holds the real number, within 1 to 4 (Trevor, 2026-10-19).
	const fewest = page.getByRole('combobox', { name: 'Fewest hidden characters to tell the table' });
	const most = page.getByRole('combobox', { name: 'Most hidden characters to tell the table' });
	await expect(fewest).toContainText('3');
	await expect(most).toContainText('4');
	// Rolling one again swaps it for another off-script character of the same type.
	const reroll = extras.nth(0).getByRole('button', { name: /^Roll again instead of / });
	const before = await reroll.getAttribute('aria-label');
	await reroll.tap();
	await expect(
		extras.nth(0).getByRole('button', { name: /^Roll again instead of / })
	).not.toHaveAttribute('aria-label', before!);
	// The Storyteller can choose the character, or leave a row empty.
	await extras.nth(1).getByRole('button', { name: 'Choose a hidden Outsider' }).tap();
	const picker = page.getByRole('dialog', { name: 'Choose a hidden Outsider' });
	await picker.getByRole('searchbox').fill('Goon');
	await picker.getByRole('button', { name: /^Goon\b/ }).tap();
	await expect(picker).toBeHidden();
	await expect(extras.nth(1)).toContainText('Goon');
	// A long name ends in "…" in its badge; the row's tools keep their place (Trevor,
	// 2026-10-23: "long name pushes rest of stuff to side").
	await extras.nth(2).getByRole('button', { name: 'Choose a hidden Minion' }).tap();
	const minions = page.getByRole('dialog', { name: 'Choose a hidden Minion' });
	await minions.getByRole('searchbox').fill('Devil');
	await minions.getByRole('button', { name: /^Devil.s Advocate\b/ }).tap();
	await expect(minions).toBeHidden();
	await expect(extras.nth(2)).toContainText(/Devil.s Advocate/);
	const row = (await extras.nth(2).boundingBox())!;
	const clear = (await extras
		.nth(2)
		.getByRole('button', { name: 'Clear the hidden Minion' })
		.boundingBox())!;
	expect(clear.x + clear.width).toBeLessThanOrEqual(row.x + row.width + 1);
	await noSidewaysScroll(page);
	await extras.nth(2).getByRole('button', { name: 'Clear the hidden Minion' }).tap();
	await expect(extras.nth(2)).toContainText('None');
	await extras.nth(3).getByRole('button', { name: 'Clear the hidden Demon' }).tap();
	await expect(fewest).toContainText('1');
	await expect(most).toContainText('3');
	// "The story teller puts in 2, any statement that includes 2 would be accurate 1-3, 1-4,
	// 2-3, 2": the exact number, or a wider range.
	await fewest.tap();
	await page.getByRole('option', { name: '2', exact: true }).tap();
	await most.tap();
	await expect(page.getByRole('option')).toHaveText(['2', '3', '4']);
	await page.getByRole('option', { name: '2', exact: true }).tap();
	await expect(page.getByTestId('extras-range')).toContainText('Tell the table:');
	await expect(fewest).toContainText('2');
	await expect(most).toContainText('2');
	await noSidewaysScroll(page);

	const hidden = await page
		.getByTestId('extras')
		.locator('[data-character-id]')
		.evaluateAll((els) => els.map((el) => el.getAttribute('data-character-id')!));
	expect(hidden).toHaveLength(2);
	// Off the script but chosen for the bag: listed under their own types (Trevor,
	// 2026-10-18), and not marked as off the script, since the rule put them in play
	// (Trevor, 2026-10-23).
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('count-minion')).toHaveText('0');
	await expect(page.locator('.ring-row[data-dashed]')).toHaveCount(0);
	const first = page.locator(`.main[data-character-id="${hidden[0]}"]`);
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.ring-row', { has: first })).not.toContainText('Not on script');
	// Taking one out keeps it listed, so it can go back in.
	await first.tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await expect(first).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator(`.main[data-character-id="${hidden[1]}"]`)).toBeVisible();
});

test('with no hidden character, Infinite Possibilities says how many are needed', async ({
	page
}) => {
	await page.goto('/new');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'A Script of Infinite Possibilities');
	await expect(page).toHaveURL(/\/setup$/);
	const extras = page.getByTestId('extras').locator('li');
	await expect(extras).toHaveCount(4);
	const needed = page.getByTestId('extras-needed');
	await expect(needed).toBeHidden();
	// The roll fills at least one row.
	await expect(
		extras.getByRole('button', { name: /^Roll again instead of / }).first()
	).toBeVisible();
	// One row of each type (Trevor, 2026-10-19).
	for (const [i, type] of ['Townsfolk', 'Outsider', 'Minion', 'Demon'].entries()) {
		const clear = extras.nth(i).getByRole('button', { name: `Clear the hidden ${type}` });
		if (await clear.isEnabled()) await clear.tap();
	}
	// A warning, never a lock (the Storyteller overrides anything); its line is always there.
	await expect(needed).toBeVisible();
	await expect(needed).toHaveText('1–4 needed');
});

test('Flesh and Bone runs a campaign: the next game adds a Demon once the current game has ended', async ({
	page
}) => {
	// https://fleshandbone.app/rules.php
	await page.goto('/new');
	await chooseMode(page, 'Flesh and Bone');
	const panel = modesPanel(page);
	// No campaign yet: a new one starts from the chosen script.
	await expect(panel.getByRole('combobox', { name: 'Campaign' })).toHaveCount(0);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+/);
	const { campaignId, gameId } = await page.evaluate(() => {
		const [c] = JSON.parse(localStorage.getItem('grim-games:campaigns:v1') ?? '[]');
		return { campaignId: c.campaignId as string, gameId: c.games[0].gameId as string };
	});

	await page.goto(`/campaigns/${campaignId}`);
	await expect(page.getByRole('heading', { name: 'Flesh and Bone', level: 1 })).toBeVisible();
	const games = page.getByTestId('campaign-games').locator('li');
	await expect(games).toHaveCount(1);
	await expect(page.getByTestId('campaign-eliminated')).toHaveText('None');
	const next = page.getByRole('button', { name: 'Next game' });
	await expect(next).toBeDisabled();
	await expect(page.getByTestId('campaign-next-hint')).toHaveText(
		'End the current game to start the next'
	);
	await noSidewaysScroll(page);

	// Ending the game itself is covered by the grimoire tests; here it is recorded directly.
	await page.evaluate((id) => {
		localStorage.setItem(
			'grim-games:ended-games:v1',
			JSON.stringify({ [id]: { endedAt: Date.now(), winner: 'good' } })
		);
	}, gameId);
	await page.reload();
	await expect(next).toBeEnabled();
	await next.tap();
	const plan = page.getByRole('dialog', { name: 'Next game' });
	await expect(plan.getByTestId('campaign-plan')).toContainText('Executed');
	// Nobody was executed, so the script changes by one more Demon.
	const changes = plan.getByTestId('campaign-changes').locator('li');
	await expect(changes).toHaveCount(1);
	await expect(changes.first()).toContainText('Added');
	await plan.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);

	await page.goto(`/campaigns/${campaignId}`);
	await expect(games).toHaveCount(2);
	await expect(games.nth(0)).toContainText('Ended');
	await expect(next).toBeDisabled();

	// Every version of the living script is in the Library (Trevor, 2026-10-18).
	await page.goto('/library');
	await page.getByTestId('library-sidebar').getByRole('button', { name: 'Campaigns' }).tap();
	const campaigns = page.getByTestId('library-campaigns').locator('tbody tr');
	await expect(campaigns).toHaveCount(1);
	await expect(campaigns.first()).toContainText('Flesh and Bone');
	await expect(campaigns.first()).toContainText('2 versions');
	await campaigns.first().getByRole('button').tap();
	const versions = page.getByRole('dialog', { name: 'Flesh and Bone' });
	await expect(versions.getByTestId('campaign-script-scroll')).toContainText('game 2');
	await expect(versions.getByRole('link', { name: 'Campaign' })).toBeVisible();

	// New game asks which campaign; an ongoing one plays a saved version, the latest unless
	// changed (Trevor, 2026-10-18).
	await page.goto('/new');
	await chooseMode(page, 'Flesh and Bone');
	const campaign = panel.getByRole('combobox', { name: 'Campaign' });
	await expect(campaign).toContainText('New campaign');
	await campaign.tap();
	await page.getByRole('option', { name: /Trouble Brewing/ }).tap();
	await expect(panel.getByRole('radiogroup', { name: 'Script' })).toHaveCount(0);
	const version = panel.getByRole('combobox', { name: 'Script version' });
	await expect(version).toContainText('Game 2');
	await version.tap();
	await page.getByRole('option', { name: /^Game 1/ }).tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+/);
	await page.goto(`/campaigns/${campaignId}`);
	await expect(games).toHaveCount(3);
});

test('Specters: spectators vote on their phones and the Storyteller sees the count', async ({
	page,
	browser
}, testInfo) => {
	// https://www.youtube.com/watch?v=-R34QbIgDh8
	await page.goto('/new');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'Specters');
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+/);
	const gameId = new URL(page.url()).pathname.split('/')[2];

	await page.goto(`/grimoire/${gameId}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const shareCode = page.getByTestId('share-code');
	await expect(shareCode).toHaveText(/^\s*\d{3}\s?\d{3}\s*$/);
	const code = (await shareCode.textContent())!.replace(/\s/g, '');

	// Specters opens over the board from Game info (Trevor, 2026-10-18: the grimoire stays in
	// reach). Where the corner has no room for the name before setup, ⋯ has Game info instead.
	await page.goto(`/grimoire/${gameId}`);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	await page
		.getByRole('dialog', { name: 'Game info', exact: true })
		.getByRole('button', { name: 'Specters vote and ability' })
		.tap();
	const sheet = page.getByRole('dialog', { name: 'Specters vote and ability' });
	// The rule behind the sheet sits at its top (Trevor, 2026-10-23).
	await expect(sheet.getByTestId('rule-header')).toContainText('Specters');
	await expect(sheet.getByRole('button', { name: 'Inspect Specters' })).toBeVisible();
	await expect(sheet).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/grimoire/${gameId}$`));
	// The Storyteller sets the ability: the Wizard's by default, or their own words.
	await expect(sheet.getByRole('button', { name: 'Wizard' })).toBeVisible();
	await sheet.getByRole('combobox', { name: 'Kind of ability' }).tap();
	await page.getByRole('option', { name: 'Custom' }).tap();
	await sheet.getByRole('textbox', { name: 'Ability' }).fill('Swap two players’ seats');

	// A phone without a seat is a spectator.
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await expect(page.getByTestId('specters-room')).toHaveText('0/1 spectators voted');
	// Only phones connected now count: the room keeps every phone that joined (2026-10-25).
	const leaverContext = await browser.newContext({ ...testInfo.project.use });
	const leaver = await leaverContext.newPage();
	await leaver.goto(`/join/${code}`);
	await expect(leaver.getByTestId('join-status')).toHaveText('');
	await expect(page.getByTestId('specters-room')).toHaveText('0/2 spectators voted');
	await leaverContext.close();
	await expect(page.getByTestId('specters-room')).toHaveText('0/1 spectators voted');

	await sheet.getByRole('button', { name: 'Open vote' }).tap();
	const vote = phone.getByRole('dialog', { name: 'Spectators’ vote' });
	await expect(vote).toBeVisible();
	await expect(vote.getByTestId('spectator-ability')).toHaveText('Swap two players’ seats');
	await vote.getByRole('button', { name: /^2\s*Seat 2$/ }).tap();
	await expect(vote.getByRole('button', { name: /^2\s*Seat 2$/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByTestId('specters-room')).toHaveText('1/1 spectators voted');
	const tally = page.getByTestId('specters-tally').locator('li');
	await expect(tally.nth(1)).toHaveAttribute('data-most', 'true');
	await expect(tally.nth(1)).toContainText('1');

	// Closing the vote closes it on the phone; the count stays for the Storyteller.
	await sheet.getByRole('button', { name: 'Close vote' }).tap();
	await expect(vote).toBeHidden();
	await expect(tally.nth(1)).toHaveAttribute('data-most', 'true');
	await noSidewaysScroll(page);
	await phoneContext.close();
});

test('New game shows each script’s author under its name, and its versions in a drop-down', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'grim-games:scripts:quick-play',
			JSON.stringify({
				schemaVersion: 1,
				scriptId: 'quick-play',
				name: 'Byline Test',
				json: [{ id: '_meta', name: 'Byline Test', author: 'Test Author' }, 'washerwoman', 'imp'],
				source: { kind: 'botcscripts', scriptId: 1, version: '2.1' },
				addedAt: 1,
				lastUsedAt: 1,
				revision: 1
			})
		);
	});
	await page.goto('/new');
	const custom = page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Custom', { exact: true });
	// Under the picker once chosen, on a line that was already there (Trevor, 2026-10-19):
	// Custom chooses the most recent custom script. Its version is a drop-down, empty and
	// disabled until then.
	const line = page.getByTestId('chosen-script');
	const version = page.getByRole('combobox', { name: 'Script version' });
	await expect(version).toBeDisabled();
	await expect(version).not.toContainText('v');
	const before = await line.boundingBox();
	await custom.tap();
	await expect(page.getByTestId('chosen-script').getByTestId('script-byline')).toHaveText(
		'by Test Author'
	);
	await expect(version).toContainText('v2.1');
	expect((await line.boundingBox())?.height).toBe(before?.height);
	// In the script search's list too, on Standard and in a mode alike.
	const option = page.getByRole('option').filter({ hasText: 'Byline Test' });
	await page.getByRole('combobox', { name: 'Find a script' }).tap();
	await expect(option).toContainText('by Test Author');
	await expect(option).toContainText('2.1');
	await page.keyboard.press('Escape');
	await chooseMode(page, 'Flesh and Bone');
	await custom.tap();
	await page.getByRole('combobox', { name: 'Find a script' }).tap();
	await expect(option).toContainText('by Test Author');
});

test('a BotC Scripts script offers every version it has, and Game info links its page', async ({
	page
}) => {
	// Trevor, backlog L14: "a script with multiple versions shows only the saved version",
	// and the script name in Game info links to its source page.
	await page.addInitScript(() => {
		localStorage.setItem(
			'grim-games:scripts:quick-play',
			JSON.stringify({
				schemaVersion: 1,
				scriptId: 'quick-play',
				name: 'Many Versions',
				json: [{ id: '_meta', name: 'Many Versions', author: 'Test Author' }, 'washerwoman', 'imp'],
				source: { kind: 'botcscripts', scriptId: 7, version: '2.1' },
				addedAt: 1,
				lastUsedAt: 1,
				revision: 1
			})
		);
	});
	await page.route('**/api/botcscripts/versions/7', (route) =>
		route.fulfill({ json: { scriptId: 7, latest: '2.2', versions: ['2.2', '2.1', '2.0'] } })
	);
	// The version arrives only when the test says, so its loading state can be seen.
	let release = () => {};
	const held = new Promise<void>((done) => (release = done));
	await page.route('**/api/botcscripts/script/7/2.2', async (route) =>
		held.then(() =>
			route.fulfill({
				json: {
					scriptId: 7,
					versionId: 70,
					name: 'Many Versions',
					version: '2.2',
					author: 'Test Author',
					content: [{ id: '_meta', name: 'Many Versions', author: 'Test Author' }, 'chef', 'imp']
				}
			})
		)
	);
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Custom', { exact: true }).tap();
	const version = page.getByRole('combobox', { name: 'Script version' });
	await expect(version).toContainText('v2.1');
	await version.tap();
	await expect(page.getByRole('option')).toHaveText([/v2\.2/, /v2\.1/, /v2\.0/]);
	await page.getByRole('option', { name: /v2\.2/ }).tap();
	// While it loads, a spinner sits on the drop-down, which waits (Trevor, 2026-10-22).
	const loading = page.getByTestId('version-loading');
	await expect(loading).toBeVisible();
	await expect(loading).toHaveAccessibleName('Loading this version…');
	await expect(version).toBeDisabled();
	const box = (await version.boundingBox())!;
	release();
	await expect(loading).toHaveCount(0);
	await expect(version).toContainText('v2.2');
	expect(await version.boundingBox()).toEqual(box);
	// The chosen script's source page opens from New game too (Trevor, 2026-10-22).
	await expect(
		page.getByTestId('chosen-script').getByRole('link', { name: "Open the script's source page" })
	).toHaveAttribute('href', /\/script\/7\/2\.2/);
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);

	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	const info = page.getByTestId('game-info');
	await expect(info.getByRole('link', { name: 'Many Versions' })).toHaveAttribute(
		'href',
		/\/script\/7\/2\.2/
	);
	await expect(info.locator('[data-field="version"] td:last-child')).toHaveText('2.2');
	// Its file is saved from beside its name (Trevor, 2026-10-22, plan G3; 2026-10-27).
	await expect(page.getByTestId('share-source')).toHaveCount(0);
	await expect(
		info.locator('[data-field="script"]').getByTestId('game-info-download')
	).toBeVisible();
	const download = page.waitForEvent('download');
	await page.getByTestId('game-info-download').tap();
	const file = await download;
	expect(file.suggestedFilename()).toBe('many-versions.json');
	const json = JSON.parse(await readFile((await file.path())!, 'utf8')) as unknown[];
	expect(json).toContainEqual(expect.objectContaining({ id: '_meta', name: 'Many Versions' }));
	expect(json).toContain('chef');
});

test('Game info opens a special rule in full when tapped, and a base script shares its wiki page', async ({
	page
}) => {
	// Trevor, 2026-10-22 (plan G5): "allow clicking game mode or special rules in game info to
	// see exact detalis of that game mode".
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'Stowed Away');
	await toBoard(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	const info = page.getByTestId('game-info');
	// Standard is no mode to open; the rule's name opens its About, parts and rule file.
	await expect(info.locator('[data-field="mode"] td:last-child button')).toHaveCount(0);
	// A base script's source page is its wiki page (Trevor, 2026-10-23), its name the link.
	await expect(info.getByRole('link', { name: 'Trouble Brewing' })).toHaveAttribute(
		'href',
		'https://wiki.bloodontheclocktower.com/Trouble_Brewing'
	);
	await info.getByRole('button', { name: 'Inspect Stowed Away' }).tap();
	const inspect = page.getByRole('dialog', { name: 'Stowed Away' });
	await expect(inspect.getByTestId('mode-about')).toBeVisible();
	await expect(inspect.getByRole('button', { name: 'Rule file', exact: true })).toBeVisible();
	await noSidewaysScroll(page);
});

test('a base script opens its wiki page from New game', async ({ page }) => {
	// Trevor, 2026-10-23: the base three link the BotC wiki as their source.
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Bad Moon Rising').tap();
	await expect(
		page.getByTestId('chosen-script').getByRole('link', { name: "Open the script's source page" })
	).toHaveAttribute('href', 'https://wiki.bloodontheclocktower.com/Bad_Moon_Rising');
});

test('a custom script without a version shows N/A as its version', async ({ page }) => {
	// Trevor, 2026-10-19: N/A in the version drop-down, not an empty one.
	await page.addInitScript(() => {
		localStorage.setItem(
			'grim-games:scripts:quick-play',
			JSON.stringify({
				schemaVersion: 1,
				scriptId: 'quick-play',
				name: 'No Version Test',
				json: [{ id: '_meta', name: 'No Version Test' }, 'washerwoman', 'imp'],
				source: { kind: 'file', fileName: 'no-version.json' },
				addedAt: 1,
				lastUsedAt: 1,
				revision: 1
			})
		);
	});
	await page.goto('/new');
	const version = page.getByRole('combobox', { name: 'Script version' });
	await expect(version).not.toContainText('N/A');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Custom', { exact: true }).tap();
	await expect(page.getByRole('combobox', { name: 'Find a script' })).toHaveValue(
		'No Version Test'
	);
	await expect(version).toHaveText('N/A');
	await expect(version).toBeDisabled();
	// A file has no page: the source button stays in place, disabled, naming the file.
	await expect(
		page.getByRole('button', { name: 'No source page (no-version.json)' })
	).toBeDisabled();
});

test('any script beyond the base three is found by typing, or picked in the Library', async ({
	page
}) => {
	// Trevor, 2026-10-19: easy to reach with 50 scripts.
	await page.goto('/new');
	const script = page.getByRole('radiogroup', { name: 'Script' });
	// The base three and Custom; the search and Library are Custom's, and tapping either
	// chooses Custom (Trevor, backlog L6).
	await expect(script.getByRole('radio')).toHaveCount(4);
	const custom = script.getByRole('radio', { name: 'Custom' });
	const search = page.getByRole('combobox', { name: 'Find a script' });
	const library = page.getByRole('button', { name: 'Choose from the Library' });
	await expect(custom).not.toBeChecked();
	await search.tap();
	await expect(custom).toBeChecked();
	await search.fill('no such script');
	await expect(page.getByRole('listbox')).toContainText('None');
	await page.getByRole('option', { name: 'Find more scripts online' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await page.goto('/new');
	await expect(custom).not.toBeChecked();
	await library.tap();
	const browser = page.getByRole('dialog', { name: 'Choose from the Library' });
	await expect(browser).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(browser).toBeHidden();
	await expect(custom).toBeChecked();
});

test('special rules stack on a mode: two at once, a conflict warns, and the game starts anyway', async ({
	page
}) => {
	// Whale Buffet plays every character; Infinite Possibilities adds hidden extras to a
	// script, so the two set the character pool differently (format-design.md: warn, never
	// stop the game).
	await page.goto('/new');
	await chooseMode(page, 'Whale Buffet');
	await chooseRules(page, 'Stowed Away', 'A Script of Infinite Possibilities');
	await modesPanel(page)
		.getByRole('button', { name: /^Special rules/ })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	// Conflicts come first, in plain words, with each side's description, Inspect and switch
	// (Trevor, 2026-10-22).
	const conflicts = dialog.getByTestId('rule-conflicts');
	await expect(conflicts).toContainText(
		'Both change “Character pool” in different ways, so only one can apply.'
	);
	await expect(conflicts).toContainText('Game mode: Whale Buffet');
	await expect(conflicts.getByRole('button', { name: 'Inspect Whale Buffet' })).toBeVisible();
	const infinite = conflicts.getByRole('checkbox', {
		name: 'A Script of Infinite Possibilities',
		includeHidden: true
	});
	await expect(infinite).toBeChecked();
	const conflictsBox = await conflicts.boundingBox();
	const listBox = await dialog.getByTestId('special-rules').boundingBox();
	expect(conflictsBox!.y).toBeLessThan(listBox!.y);
	// Turning a side off there settles it.
	await conflicts.getByText('A Script of Infinite Possibilities', { exact: true }).tap();
	await expect(conflicts).toHaveText('None');
	await dialog
		.getByTestId('special-rules')
		.getByText('A Script of Infinite Possibilities', { exact: true })
		.tap();
	await expect(conflicts).toContainText('Game mode: Whale Buffet');
	// Inspect shows a rule's own parts and its rule file.
	await dialog
		.getByTestId('special-rules')
		.getByRole('button', { name: 'Inspect A Script of Infinite Possibilities' })
		.tap();
	const inspect = page.getByRole('dialog', { name: 'A Script of Infinite Possibilities' });
	await expect(inspect.locator('li[data-part="pool"]')).toHaveAttribute('data-status', 'runs');
	await expect(inspect.getByRole('button', { name: 'Rule file', exact: true })).toBeVisible();
	await inspect.getByRole('button', { name: 'Close' }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await noSidewaysScroll(page);

	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
	// The game is named for its mode and rules wherever it is listed.
	await page.goto('/join');
	await expect(page.getByTestId('game-mode').first()).toContainText(
		'Whale Buffet + Stowed Away + A Script of Infinite Possibilities'
	);
});

test('Special rules sits under Game mode for a mode that drafts, and opening it closes the Game mode list', async ({
	page
}) => {
	// Trevor, 2026-10-19: Special rules directly beneath Game mode; the Game mode list stayed
	// open over the Special rules dialog. Standard has none there since 2026-10-29.
	await page.goto('/new');
	const panel = modesPanel(page);
	const rules = panel.getByRole('button', { name: /^Special rules/ });
	await expect(rules).toHaveCount(0);
	await chooseMode(page, 'Whale Buffet');
	const modes = panel.getByRole('combobox', { name: 'Game mode' });
	const about = panel.getByTestId('mode-about');
	const [modeBox, rulesBox, aboutBox] = await Promise.all(
		[modes, rules, about].map((l) => l.boundingBox())
	);
	expect(rulesBox!.y).toBeGreaterThan(modeBox!.y);
	expect(rulesBox!.y).toBeLessThan(aboutBox!.y);

	await modes.tap();
	await expect(page.getByRole('listbox')).toBeVisible();
	// A tap that reaches the button without first closing the list, as on Trevor's phone.
	await rules.evaluate((el: HTMLElement) => el.click());
	await expect(page.getByRole('dialog', { name: 'Special rules' })).toBeVisible();
	await expect(page.getByRole('listbox')).toBeHidden();
	await noSidewaysScroll(page);
});

test('each special rule shows its description beside its switch, with a line between rules', async ({
	page
}) => {
	// Trevor, 2026-10-19: descriptions when toggling, the rest behind Inspect. Only approved
	// descriptions show (I See Dead People's was approved the same day).
	const dialog = await openRulesOnSetup(page);
	const rows = dialog.getByTestId('special-rules').locator('li');
	const specters = rows.filter({ hasText: 'Specters' });
	await expect(specters.locator('.toggle-description')).toHaveText(
		'Spectators share one ability and vote during the game on how it is used.'
	);
	// A rule with its author's rule text shows that text (Trevor, 2026-10-22).
	await expect(
		rows.filter({ hasText: 'I See Dead People' }).locator('.toggle-description')
	).toHaveText(
		"Characters die as normal but the storyteller doesn't announce deaths. Dead players can nominate. Poisoned players don't wake up."
	);
	// Trevor (2026-10-22): no text beneath a switch; the switch stays on the name's line.
	const text = (await specters.locator('.toggle-description').boundingBox())!;
	const control = (await specters.locator('[data-part="control"]').first().boundingBox())!;
	expect(text.x + text.width).toBeLessThanOrEqual(control.x);
	const name = (await specters.getByText('Specters', { exact: true }).boundingBox())!;
	expect(control.y).toBeLessThan(name.y + name.height);
	await expect(rows.nth(1)).toHaveCSS('border-top-style', 'solid');
	await noSidewaysScroll(page);
});

test('special rules read plainly in Inspect, and Special rules looks like the controls beside it', async ({
	page
}) => {
	await page.goto('/new');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	// Trevor, 2026-10-19: "Special rules button looks different from other button on page".
	const options = page.getByTestId('game-options');
	const button = page.getByTestId('setup-special-rules');
	const modes = options.getByRole('button', { name: 'Game settings' });
	const look = (l: typeof button) =>
		l.evaluate((el) => {
			const s = getComputedStyle(el);
			return [s.borderTopWidth, s.borderTopStyle, s.backgroundColor, s.justifyContent];
		});
	const [width, style, background] = await look(modes);
	expect(await look(button)).toEqual([width, style, background, 'flex-start']);

	await button.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	const inspect = async (name: string) => {
		await dialog.getByRole('button', { name: `Inspect ${name}` }).tap();
		return page.getByRole('dialog', { name });
	};
	const close = async (d: Locator) => {
		await d.getByRole('button', { name: 'Close' }).tap();
		await expect(d).toBeHidden();
	};
	// Seat 7's seat count was labelled Towns.
	const seat7 = await inspect('The Ballad of Seat 7');
	const seats = seat7.locator('li[data-part="seats"]');
	await expect(seats.locator('tr[data-field="count"] th')).toHaveText('Seats');
	await expect(seats.locator('tr[data-field="speaks"] td')).toHaveText('Once per game');
	await close(seat7);
	// Stowed Away is 0 to 2 Travellers in the bag; its rule text reads as sentences, as its
	// description, and isn't listed again as a part (Trevor, 2026-10-22).
	const stowed = await inspect('Stowed Away');
	await expect(stowed.locator('tr[data-field="inBag"] td')).toHaveText('0–2');
	await expect(stowed.getByTestId('inspect-about')).not.toContainText('., ');
	await expect(stowed.locator('li[data-part="text"]')).toHaveCount(0);
	await close(stowed);
	// Infinite Possibilities: one of each type, nothing restricted, and the Storyteller may
	// tell the table how many.
	const infinite = await inspect('A Script of Infinite Possibilities');
	await expect(infinite.locator('li[data-part="restricted"]')).toHaveCount(0);
	await expect(infinite.locator('li[data-part="information"]')).toHaveCount(0);
	const extras = infinite.locator('tr[data-field="extras"] td tr');
	await expect(extras).toHaveText([/Townsfolk\s*1/, /Outsiders\s*1/, /Minions\s*1/, /Demons\s*1/]);
	await expect(infinite.locator('tr[data-field="announceRange"]')).toContainText('Yes');
	await noSidewaysScroll(page);
});

test('each special rule takes its own line under the script name in the board corner', async ({
	page
}) => {
	// Trevor (2026-10-19): a line each, so none is run together or cut off with the others.
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'Stowed Away', 'I See Dead People');
	await toBoard(page);
	const corner = page.getByTestId('script-title');
	const lines = corner.getByTestId('game-mode');
	await expect(corner).toBeVisible();
	if (test.info().project.name === 'phone') {
		// A phone's corner beside seat 5 has room for the name and one line: the rules share it.
		await expect(lines).toHaveText(['Stowed Away + I See Dead People']);
		return;
	}
	await expect(lines).toHaveText(['Stowed Away', 'I See Dead People']);
	const [first, second] = [
		(await lines.nth(0).boundingBox())!,
		(await lines.nth(1).boundingBox())!
	];
	expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
	await expect(page.getByTestId('script-title')).not.toContainText('+');
});

test('with I See Dead People a death is marked not to announce, its detail kept for the Storyteller', async ({
	page
}) => {
	// World Cup thread (2026-10-19): the rule hides deaths, so the day says not to announce.
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'I See Dead People');
	await toBoard(page);
	// The death is marked on the board (Trevor, 2026-10-20), then read in the day view.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 1' })
		.getByRole('button', { name: 'The Demon', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const announcements = page.getByTestId('announcements');
	await expect(announcements.getByTestId('dont-announce')).toHaveText('Don’t announce');
	await expect(announcements.getByTestId('spoken')).toHaveCount(0);
	await expect(announcements.getByTestId('storyteller-only')).toHaveText(
		'No character, killed by the Demon'
	);
});

test('+1 adds exactly one character from off the script', async ({ page }) => {
	// Trevor (2026-10-22): the chosen script plus exactly one off-script character in play.
	await page.goto('/new');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, '+1');
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const extras = page.getByTestId('extras').locator('li');
	await expect(extras).toHaveCount(4);
	// The roll fills one row; the table is told there is one, so no range is offered.
	const filled = extras.getByRole('button', { name: /^Roll again instead of / });
	await expect(filled).toHaveCount(1);
	await expect(page.getByTestId('extras-range')).toHaveCount(0);
	const needed = page.getByTestId('extras-needed');
	await expect(needed).toBeHidden();
	// A second one is too many.
	for (const [i, type] of ['Townsfolk', 'Outsider', 'Minion', 'Demon'].entries()) {
		const clear = extras.nth(i).getByRole('button', { name: `Clear the hidden ${type}` });
		if (await clear.isEnabled()) await clear.tap();
	}
	await expect(needed).toHaveText('1 needed');
	await expect(needed).toBeVisible();
	await extras.nth(1).getByRole('button', { name: 'Choose a hidden Outsider' }).tap();
	const picker = page.getByRole('dialog', { name: 'Choose a hidden Outsider' });
	await picker.getByRole('searchbox').fill('Goon');
	await picker.getByRole('button', { name: /^Goon\b/ }).tap();
	await expect(needed).toBeHidden();
	await extras.nth(2).getByRole('button', { name: 'Choose a hidden Minion' }).tap();
	const minions = page.getByRole('dialog', { name: 'Choose a hidden Minion' });
	await minions.getByRole('searchbox').fill('Witch');
	await minions.getByRole('button', { name: /^Witch\b/ }).tap();
	await expect(needed).toBeVisible();
	await extras.nth(2).getByRole('button', { name: 'Clear the hidden Minion' }).tap();
	await noSidewaysScroll(page);

	// Listed, but not marked as off the script: +1 put it in play (Trevor, 2026-10-23).
	await expect(page.locator('.main[data-character-id="goon"]')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.locator('.ring-row[data-dashed]')).toHaveCount(0);
});

test('Game info’s Special rules opens the screen once the game is set up', async ({ page }) => {
	// Trevor (2026-10-23): "This special rules button seems to do nothing but flash the page".
	await trackSaves(page);
	await page.goto('/new');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, '+1');
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	const extras = page.getByTestId('extras').locator('li');
	for (const [i, type] of ['Townsfolk', 'Outsider', 'Minion', 'Demon'].entries()) {
		const clear = extras.nth(i).getByRole('button', { name: `Clear the hidden ${type}` });
		if (await clear.isEnabled()) await clear.tap();
	}
	await extras.nth(1).getByRole('button', { name: 'Choose a hidden Outsider' }).tap();
	const picker = page.getByRole('dialog', { name: 'Choose a hidden Outsider' });
	await picker.getByRole('searchbox').fill('Goon');
	await picker.getByRole('button', { name: /^Goon\b/ }).tap();
	for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	for (const name of ['Washerwoman', 'Empath', 'Poisoner', 'Imp'])
		await page
			.getByTestId('character-picker')
			.getByRole('button', { name: new RegExp(`^${name}\\b`) })
			.first()
			.tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	const confirm = page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' });
	if (await confirm.isVisible()) await confirm.tap();
	await expect(page).toHaveURL(`${board}/draw`);
	for (let n = 1; n <= 5; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await savesSettled(page);
	await page.goto(board);
	// +1 put the Goon in play, so its seat is not flagged as off the script (Trevor,
	// 2026-10-23).
	await expect(page.getByRole('button', { name: /, Goon\b/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /not on the script/ })).toHaveCount(0);
	await expect(page.locator('.mark.orphan')).toHaveCount(0);
	await page.getByTestId('mode-menu').tap();
	await page
		.getByRole('dialog', { name: 'Game info', exact: true })
		.getByRole('button', { name: 'Special rules', exact: true })
		.tap();
	// It stays on the screen rather than going straight back to the board.
	await expect(page).toHaveURL(`${board}/extras`);
	await expect(page.getByRole('heading', { name: 'Special rules', level: 1 })).toBeVisible();
	await expect(extras.nth(1)).toContainText('Goon');
	await page.waitForTimeout(500);
	await expect(page).toHaveURL(`${board}/extras`);
	// Characters are chosen by now: the bar goes back to the board.
	const bar = page.getByRole('navigation', { name: 'Setup', exact: true });
	await expect(bar.getByRole('button', { name: 'Game settings' })).toHaveCount(0);
	await bar.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page).toHaveURL(board);
});

// Trevor (2026-10-24): "add special rule, Duplicate Characters. There can be multiple copies
// of characters in the bag."
test('Duplicate Characters lets any character but a Demon be chosen twice and sit on two seats', async ({
	page
}) => {
	await page.goto('/new');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'Duplicate Characters');
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const chef = page
		.getByRole('button', { name: 'Chef', exact: true })
		.and(page.locator('[aria-pressed]'));
	await chef.tap();
	await page.getByRole('button', { name: 'Add another Chef' }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('2');
	await noSidewaysScroll(page);
	await toBoard(page);
	const assign = async (number: number, name: string) => {
		await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
		const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${number}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
	};
	const flagged = page.getByText('That character is already on another seat.');
	await assign(1, 'Chef');
	await assign(2, 'Chef');
	await expect(
		page.locator('[data-testid="seat"][aria-label^="Seat 2: no name, Chef"]')
	).toBeAttached();
	await expect(flagged).toHaveCount(0);
	// A second Demon is still flagged unless the rule's Duplicate Demons switch is on (Trevor,
	// 2026-10-24).
	await assign(3, 'Imp');
	await assign(4, 'Imp');
	await expect(flagged).toBeVisible();
});

test('Special rules restates the rules in the game first, with their own switches', async ({
	page
}) => {
	// Trevor (2026-10-22): the rules in the game restated; since 2026-10-29 at the top of
	// Character selection's Special rules, not a screen before it.
	await page.goto('/new');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, '+1', 'Binary Supernovae');
	await page.getByTestId('setup-special-rules').tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	const items = dialog.getByTestId('rules-in-game').locator(':scope > li');
	await expect(items).toHaveCount(2);
	await expect(items.nth(1)).toContainText('Binary Supernovae');
	await expect(items.nth(1)).toContainText('If a Demon dies by execution, good wins.');
	// The rule's switches change here (Trevor, 2026-10-23).
	const announce = items
		.nth(0)
		.getByRole('checkbox', { name: 'Storyteller announces character', includeHidden: true });
	await expect(announce).not.toBeChecked();
	await items.nth(0).getByText('Storyteller announces character', { exact: true }).tap();
	await expect(announce).toBeChecked();
	await noSidewaysScroll(page);
	// Kept as the screen opens again on them.
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await page.getByTestId('setup-special-rules').tap();
	await expect(announce).toBeChecked();
});

test('Special rules has a search box', async ({ page }) => {
	// Trevor (2026-10-22): "add search bar for special rules, since it may grow large over time".
	const dialog = await openRulesOnSetup(page);
	const list = dialog.getByTestId('special-rules');
	await dialog.getByRole('searchbox', { name: 'Search special rules' }).fill('supernova');
	await expect(list.locator('li')).toHaveCount(1);
	await expect(list).toContainText('Binary Supernovae');
	await dialog.getByRole('searchbox', { name: 'Search special rules' }).fill('zzzz');
	await expect(list).toHaveText('None');
	await dialog.getByRole('button', { name: 'Clear' }).tap();
	await expect(list.getByText('+1', { exact: true })).toBeVisible();
	await noSidewaysScroll(page);
});

test('+1 has a switch for naming its character among the rules in the game, shown in its instructions', async ({
	page
}) => {
	// Trevor (2026-10-22): "add setting for +1", with his two instructions. Its switch is set
	// only once the rule is in the game, keeping the rule list clean (Trevor, 2026-10-24).
	const dialog = await openRulesOnSetup(page);
	const named = dialog.getByRole('checkbox', {
		name: 'Storyteller announces character',
		includeHidden: true
	});
	await expect(named).toHaveCount(0);
	await dialog.getByTestId('special-rules').getByText('+1', { exact: true }).tap();
	const inspectPlusOne = async (text: string) => {
		await dialog.getByTestId('special-rules').getByRole('button', { name: 'Inspect +1' }).tap();
		const inspect = page.getByRole('dialog', { name: '+1' });
		await expect(inspect).toContainText(text);
		await inspect.getByRole('button', { name: 'Close' }).tap();
		await expect(inspect).toBeHidden();
	};
	await inspectPlusOne('Tell the table that one character from off the script is in play.');
	await expect(named).not.toBeChecked();
	await dialog.getByText('Storyteller announces character', { exact: true }).tap();
	await expect(named).toBeChecked();
	await noSidewaysScroll(page);
	await inspectPlusOne('Tell the table which character from off the script is in play.');
});

test('Binary Supernovae asks for one more Demon, and an executed Demon wins it for good', async ({
	page
}) => {
	// Trevor (2026-10-22): https://beardytas.com/garden-of-djinn/binary-supernovae/ on any script.
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await modesPanel(page).getByRole('button', { name: 'Create game' }).tap();
	await chooseRulesOnSetup(page, 'Binary Supernovae');
	await toBoard(page);
	const gameId = new URL(page.url()).pathname.split('/')[2];
	await page.goto(`/grimoire/${gameId}/setup`);
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	await expect(page.locator('[data-testid="setup-counts"] [data-type="demon"]')).toContainText(
		'/ 2'
	);
	await noSidewaysScroll(page);

	// On the board, a Demon executed ends it under the rule, even with another Demon alive.
	await page.goto(`/grimoire/${gameId}`);
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 1' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	const prompt = page.getByRole('alertdialog', { name: 'End game?' });
	const line = prompt.locator('[data-rule="demon-executed"]');
	await expect(line).toContainText('Binary Supernovae');
	await expect(line).toContainText('Good wins');
});

test('New game previews the script as it will play, beside the settings', async ({ page }) => {
	// Trevor, 2026-10-22: always open, never collapsed, beside the settings on a computer and
	// under them on a phone, with the game mode's and special rules' changes.
	await page.goto('/new');
	const preview = page.getByRole('complementary', { name: 'Script preview' });
	await expect(preview.getByRole('heading', { name: 'Script preview' })).toBeVisible();
	await expect(preview).toContainText('Washerwoman');
	await expect(preview).not.toContainText('Seat 7 remains empty');
	await modesPanel(page)
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Bad Moon Rising', { exact: true })
		.tap();
	await expect(preview).toContainText('Grandmother');
	await expect(preview).not.toContainText('Washerwoman');
	// A mode with two towns previews each town's script.
	await chooseMode(page, 'Two games at once');
	await expect(preview.getByRole('heading', { name: 'Town 2 script' })).toBeVisible();
	await noSidewaysScroll(page);
});

test('the script preview’s background is a choice of neutral colours, also in Settings > Player', async ({
	page
}) => {
	// A device that had the light switch on (2026-10-23) opens on parchment.
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('seeded')) {
			localStorage.setItem('grim-games:player-settings:v1', JSON.stringify({ lightSheet: true }));
			sessionStorage.setItem('seeded', '1');
		}
	});
	await page.goto('/new');
	const copy = page.getByTestId('script-preview').getByTestId('script-copy');
	await copy.getByText('Chef').first().waitFor();
	// The script's name with its logo, above the author, as players see it (Trevor, 2026-10-24).
	const title = copy.getByTestId('script-copy-title');
	await expect(title).toHaveText('Trouble Brewing');
	await expect(title.getByTestId('script-logo')).toBeAttached();
	expect((await title.boundingBox())!.y).toBeLessThan(
		(await copy.getByTestId('script-byline').boundingBox())!.y
	);
	await expect(copy).toHaveCSS('background-color', 'rgb(251, 248, 241)');

	// Grey, tan and the other neutral colours (Trevor, 2026-10-24); nothing moves.
	const background = copy.getByRole('combobox', { name: 'Sheet background' });
	const size = async () => {
		const box = await copy.boundingBox();
		return box && { width: box.width, height: box.height };
	};
	const before = await size();
	await background.tap();
	await expect(page.getByRole('option')).toHaveText([
		'Theme',
		'Off-white',
		'Parchment',
		'Tan',
		'Grey',
		'Slate',
		'Charcoal'
	]);
	await page.getByRole('option', { name: 'Tan' }).tap();
	await expect(copy).toHaveCSS('background-color', 'rgb(233, 220, 194)');
	expect(await size()).toEqual(before);

	// Remembered on this device, and the same setting in Settings > Player.
	await page.reload();
	await expect(copy).toHaveCSS('background-color', 'rgb(233, 220, 194)');
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player' })
		.tap();
	const setting = dialog.getByRole('combobox', { name: 'Sheet background' });
	await expect(setting).toContainText('Tan');
	await setting.tap();
	await page.getByRole('option', { name: 'Slate' }).tap();
	await page.keyboard.press('Escape');
	await expect(copy).toHaveCSS('background-color', 'rgb(44, 51, 59)');
});

test('the Script sheet’s background choice sits beside Print and Share, and covers the night order too', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Trouble Brewing' });
	// One choice in the header; none in the copy itself.
	const choice = sheet.getByTestId('sheet-background');
	await expect(choice).toHaveCount(1);
	await expect(sheet.getByTestId('script-copy').getByTestId('sheet-background')).toHaveCount(0);
	// The same button as Print and Share beside it (Trevor, 2026-10-26).
	const trigger = choice.getByRole('combobox', { name: 'Sheet background' });
	await expect(trigger.locator('[data-icon="ph:paint-bucket"]')).toBeVisible();
	await expectMatchingIconRow(choice.locator('xpath=..'), [
		'Sheet background',
		'Print script',
		'Share script',
		'Settings'
	]);
	// The name under the buttons, as on /play (Trevor, 2026-10-26).
	const cog = (await sheet.getByTestId('you-button').boundingBox())!;
	const name = (await sheet.getByRole('heading', { name: 'Trouble Brewing' }).boundingBox())!;
	expect(name.y).toBeGreaterThanOrEqual(cog.y + cog.height - 1);
	await trigger.tap();
	await page.getByRole('option', { name: 'Grey' }).tap();
	await expect(sheet.getByTestId('script-copy')).toHaveCSS(
		'background-color',
		'rgb(218, 218, 218)'
	);
	await sheet.getByRole('tab', { name: 'Night' }).tap();
	await expect(sheet.getByTestId('night-sheet')).toHaveCSS(
		'background-color',
		'rgb(218, 218, 218)'
	);
	// Each character type starts under a line across the sheet (SectionStack draws it).
	await sheet.getByRole('tab', { name: 'Script' }).tap();
	const sections = sheet.getByTestId('script-copy').locator('.section-stack > section');
	await expect(sections.nth(1)).not.toHaveCSS('border-top-width', '0px');
	await expect(sections.first()).toHaveCSS('border-top-width', '0px');
});

test('the Script sheet has the players’ settings cog, opening the one Settings', async ({
	page
}) => {
	// Trevor, 2026-10-26: "settings does not show up in storyteller view of player view. This
	// should always be parity and invoke same parts".
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Trouble Brewing' });
	// The one Settings, at its list of sections (Trevor, 2026-10-27).
	await sheet.getByTestId('you-button').tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	const sections = settings.getByRole('navigation', { name: 'Settings sections' });
	await expect(sections).toBeVisible();
	// No room phone here, so no name to set.
	await sections.getByRole('button', { name: 'Player', exact: true }).tap();
	await expect(settings.getByRole('heading', { name: 'Player', level: 2 })).toBeVisible();
	await expect(settings.getByRole('button', { name: 'Edit your name' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(settings).toBeHidden();
	await expect(sheet).toBeVisible();
});
