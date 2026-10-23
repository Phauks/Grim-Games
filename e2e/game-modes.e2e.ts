import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

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
 * Special rules stack on any mode, Standard too (Trevor, 2026-10-18): switched on in their
 * own dialog from New game.
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
		`Special rules (${names.length})`
	);
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
	await expect(page.getByTestId('player-count')).toHaveCount(1);
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
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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
	// Our own wording is off by default (no authored content, Trevor 2026-10-15).
	await expect(dialog.getByTestId('inspect-about')).toHaveText('None');
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
	await expect(restricted).toContainText('(3)');
	await restricted.tap();
	const dialog = page.getByRole('dialog', { name: 'Restricted characters' });
	await dialog.getByRole('searchbox').fill('Pit-Hag');
	await dialog.getByRole('button', { name: /^Pit-Hag/ }).tap();
	await dialog.getByRole('searchbox').fill('Imp');
	await dialog.getByRole('button', { name: /^Imp\b/ }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(restricted).toContainText('(3)');

	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
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

/** Starts a 5-player Trouble Brewing game in `mode`; it opens on the draft or choose screen. */
async function startIn(page: Page, mode: string) {
	await page.goto('/new');
	await chooseMode(page, mode);
	const panel = modesPanel(page);
	// Whale Buffet plays every character, so it has no script to choose.
	const script = panel.getByRole('radiogroup', { name: 'Script' });
	if (await script.count()) await script.getByText('Trouble Brewing').tap();
	for (let n = 8; n > 5; n--) await panel.getByRole('button', { name: 'Fewer players' }).tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
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
	return id;
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
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
	await noSidewaysScroll(page);
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
	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
	const gameId = new URL(page.url()).pathname.split('/')[2];
	const record = await page.evaluate(
		(id) => JSON.parse(localStorage.getItem(`grim-games:game-mode:v2:${id}`) ?? '{}'),
		gameId
	);
	expect(record.roleRecycling).toBe(true);
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
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
});

/** Taps characters in a setup's list. */
async function pick(page: Page, names: readonly string[]) {
	for (const name of names)
		await page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]')).tap();
}

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
	await panel.getByRole('button', { name: 'Start game' }).tap();

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
	await panel.getByRole('button', { name: 'Start game' }).tap();

	// "Boomdandy and Mayor are guaranteed to be in play": the Boomdandy in the Zombuul town,
	// the Mayor in the other, each already chosen when its setup opens. Town 1's setup opens
	// first, and its bag opens town 2's (Trevor, 2026-10-18).
	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByTestId('count-minion')).toHaveText('1');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	// Required by the mode, so it can't be taken out; its lock is on and says why (Trevor,
	// 2026-10-22).
	const boomdandy = page.locator('.row', {
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
	await expect(panel.getByRole('button', { name: /^Restricted characters/ })).toContainText('(1)');

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
	await chooseRules(page, 'A Script of Infinite Possibilities');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/extras$/);
	await expect(page.getByRole('heading', { name: 'Hidden characters', level: 1 })).toBeVisible();
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

	await page.getByRole('button', { name: 'Choose characters' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	// Off the script but chosen for the bag: listed under their own types, marked (Trevor,
	// 2026-10-18).
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('count-minion')).toHaveText('0');
	const offScript = page.locator('.row[data-dashed]');
	await expect(offScript).toHaveCount(2);
	await expect(offScript.first()).toContainText('Not on script');
	await expect(offScript.first().locator('.main')).toHaveAttribute('aria-pressed', 'true');
	// Taking one out keeps it listed, so it can go back in.
	await offScript.first().locator('.main').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await expect(offScript).toHaveCount(2);
});

test('with no hidden character, Infinite Possibilities can’t go on to the setup', async ({
	page
}) => {
	await page.goto('/new');
	await chooseRules(page, 'A Script of Infinite Possibilities');
	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/extras$/);
	const extras = page.getByTestId('extras').locator('li');
	await expect(extras).toHaveCount(4);
	// The roll fills at least one row.
	await expect(
		extras.getByRole('button', { name: /^Roll again instead of / }).first()
	).toBeVisible();
	// One row of each type (Trevor, 2026-10-19).
	for (const [i, type] of ['Townsfolk', 'Outsider', 'Minion', 'Demon'].entries()) {
		const clear = extras.nth(i).getByRole('button', { name: `Clear the hidden ${type}` });
		if (await clear.isEnabled()) await clear.tap();
	}
	await expect(page.getByRole('button', { name: 'Choose characters' })).toBeDisabled();
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
	await panel.getByRole('button', { name: 'Start game' }).tap();
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
	await panel.getByRole('button', { name: 'Start game' }).tap();
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
	await chooseRules(page, 'Specters');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
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
	await expect(phone.getByTestId('join-status')).toBeVisible();
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
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);

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
	await expect(info.locator('[data-field="version"] td')).toHaveText('2.2');
	// Its source can be passed on, and its file saved (Trevor, 2026-10-22, plan G3).
	await expect(info.getByTestId('share-source')).toBeEnabled();
	const download = page.waitForEvent('download');
	await page.getByTestId('game-info-download').tap();
	const file = await download;
	expect(file.suggestedFilename()).toBe('many-versions.json');
	const json = JSON.parse(await readFile((await file.path())!, 'utf8')) as unknown[];
	expect(json).toContainEqual(expect.objectContaining({ id: '_meta', name: 'Many Versions' }));
	expect(json).toContain('chef');
});

test('Game info opens a special rule in full when tapped, and a script with no source cannot be shared', async ({
	page
}) => {
	// Trevor, 2026-10-22 (plan G5): "allow clicking game mode or special rules in game info to
	// see exact detalis of that game mode".
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await chooseRules(page, 'Stowed Away');
	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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
	await expect(info.locator('[data-field="mode"] button')).toHaveCount(0);
	// A built-in script has no source page: Share stays in its place, off, saying why.
	const share = info.getByTestId('share-source');
	await expect(share).toBeDisabled();
	await expect(share).toHaveAttribute('title', 'This script has no source page to share');
	await info.getByRole('button', { name: 'Inspect Stowed Away' }).tap();
	const inspect = page.getByRole('dialog', { name: 'Stowed Away' });
	await expect(inspect.getByTestId('mode-about')).toBeVisible();
	await expect(inspect.getByRole('button', { name: 'Rule file', exact: true })).toBeVisible();
	await noSidewaysScroll(page);
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

	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/deal$/);
	// The game is named for its mode and rules wherever it is listed.
	await page.goto('/games');
	await expect(page.getByTestId('game-mode').first()).toContainText(
		'Whale Buffet + Stowed Away + A Script of Infinite Possibilities'
	);
});

test('Special rules sits under Game mode, and opening it closes the Game mode list', async ({
	page
}) => {
	// Trevor, 2026-10-19: Special rules directly beneath Game mode; the Game mode list stayed
	// open over the Special rules dialog.
	await page.goto('/new');
	const panel = modesPanel(page);
	const modes = panel.getByRole('combobox', { name: 'Game mode' });
	const rules = panel.getByRole('button', { name: /^Special rules/ });
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
	await page.goto('/new');
	await modesPanel(page)
		.getByRole('button', { name: /^Special rules/ })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
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
	const panel = modesPanel(page);
	// Trevor, 2026-10-19: "Special rules button looks different from other button on page".
	const button = panel.getByRole('button', { name: /^Special rules/ });
	const modes = panel.getByRole('combobox', { name: 'Game mode' });
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
	await chooseRules(page, 'Stowed Away', 'I See Dead People');
	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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
	await chooseRules(page, 'I See Dead People');
	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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
	await chooseRules(page, '+1');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/extras$/);
	const extras = page.getByTestId('extras').locator('li');
	await expect(extras).toHaveCount(4);
	// The roll fills one row; the table is told there is one, so no range is offered.
	const filled = extras.getByRole('button', { name: /^Roll again instead of / });
	await expect(filled).toHaveCount(1);
	await expect(page.getByTestId('extras-range')).toHaveCount(0);
	const next = page.getByRole('button', { name: 'Choose characters' });
	await expect(next).toBeEnabled();
	// A second one is too many.
	for (const [i, type] of ['Townsfolk', 'Outsider', 'Minion', 'Demon'].entries()) {
		const clear = extras.nth(i).getByRole('button', { name: `Clear the hidden ${type}` });
		if (await clear.isEnabled()) await clear.tap();
	}
	await expect(next).toBeDisabled();
	await extras.nth(1).getByRole('button', { name: 'Choose a hidden Outsider' }).tap();
	const picker = page.getByRole('dialog', { name: 'Choose a hidden Outsider' });
	await picker.getByRole('searchbox').fill('Goon');
	await picker.getByRole('button', { name: /^Goon\b/ }).tap();
	await expect(next).toBeEnabled();
	await extras.nth(2).getByRole('button', { name: 'Choose a hidden Minion' }).tap();
	const minions = page.getByRole('dialog', { name: 'Choose a hidden Minion' });
	await minions.getByRole('searchbox').fill('Witch');
	await minions.getByRole('button', { name: /^Witch\b/ }).tap();
	await expect(next).toBeDisabled();
	await extras.nth(2).getByRole('button', { name: 'Clear the hidden Minion' }).tap();
	await noSidewaysScroll(page);

	await next.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await expect(page.locator('.row[data-dashed]')).toHaveCount(1);
	await expect(page.locator('.row[data-dashed]')).toContainText('Goon');
});

test('Start game restates the special rules first, and Back returns to New game', async ({
	page
}) => {
	// Trevor (2026-10-22): a screen that restates the special rules, with a Back button.
	await page.goto('/new');
	await chooseRules(page, '+1', 'Binary Supernovae');
	const panel = modesPanel(page);
	await panel.getByRole('button', { name: 'Start game' }).tap();
	const recap = page.getByRole('dialog', { name: 'Special rules in this game' });
	const items = recap.getByTestId('rules-recap').locator('li');
	await expect(items).toHaveCount(2);
	await expect(items.nth(1)).toContainText('Binary Supernovae');
	await expect(items.nth(1)).toContainText('If a Demon dies by execution, good wins.');
	await expect(items.nth(0)).toContainText('Name the characters Off');
	await noSidewaysScroll(page);
	// Back keeps everything as chosen.
	await recap.getByRole('button', { name: 'Back' }).tap();
	await expect(recap).toBeHidden();
	await expect(page).toHaveURL(/\/new$/);
	await expect(panel.getByRole('button', { name: /^Special rules/ })).toHaveText(
		'Special rules (2)'
	);
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await recap.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+/);
});

test('Special rules has a search box', async ({ page }) => {
	// Trevor (2026-10-22): "add search bar for special rules, since it may grow large over time".
	await page.goto('/new');
	await modesPanel(page)
		.getByRole('button', { name: /^Special rules/ })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
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

test('+1 has a switch for naming its character, shown in its instructions', async ({ page }) => {
	// Trevor (2026-10-22): "add setting for +1", with his two instructions.
	await page.goto('/new');
	await modesPanel(page)
		.getByRole('button', { name: /^Special rules/ })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Special rules' });
	const plusOne = dialog
		.getByTestId('special-rules')
		.locator('li')
		.filter({ has: page.getByText('+1', { exact: true }) });
	const named = plusOne.getByRole('checkbox', { name: 'Name the characters', includeHidden: true });
	// Always there, so nothing moves; usable once +1 is on.
	await expect(named).toBeDisabled();
	await plusOne.getByText('+1', { exact: true }).tap();
	await expect(named).toBeEnabled();
	const inspectPlusOne = async (text: string) => {
		await dialog.getByRole('button', { name: 'Inspect +1' }).tap();
		const inspect = page.getByRole('dialog', { name: '+1' });
		await expect(inspect).toContainText(text);
		await inspect.getByRole('button', { name: 'Close' }).tap();
		await expect(inspect).toBeHidden();
	};
	await inspectPlusOne('Tell the table that one character from off the script is in play.');
	await plusOne.getByText('Name the characters', { exact: true }).tap();
	await expect(named).toBeChecked();
	await inspectPlusOne('Tell the table which character from off the script is in play.');
	await noSidewaysScroll(page);
});

test('Binary Supernovae asks for one more Demon, and an executed Demon wins it for good', async ({
	page
}) => {
	// Trevor (2026-10-22): https://beardytas.com/garden-of-djinn/binary-supernovae/ on any script.
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await chooseRules(page, 'Binary Supernovae');
	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
	await page
		.getByRole('dialog', { name: 'Special rules in this game' })
		.getByRole('button', { name: 'Start game' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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
	await chooseRules(page, 'The Ballad of Seat 7');
	await expect(preview).toContainText('Seat 7 remains empty');
	// A mode with two towns previews each town's script.
	await chooseMode(page, 'Two games at once');
	await expect(preview.getByRole('heading', { name: 'Town 2 script' })).toBeVisible();
	await noSidewaysScroll(page);
});
