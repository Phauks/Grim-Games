import { expect, test, type Page } from '@playwright/test';

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
	for (const name of names) {
		await dialog.getByText(name, { exact: true }).tap();
		await expect(dialog.getByRole('checkbox', { name, includeHidden: true })).toBeChecked();
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
	await chooseMode(page, 'Whale Buffet');
	await expect(page.getByTestId('mode-about')).toBeVisible();
	await expect(page.getByTestId('player-count')).toHaveCount(1);
	await chooseMode(page, 'Standard');
	await expect(page.getByTestId('inspect-authors')).toHaveText('The Pandemonium Institute');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
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
	// Built-in Storyteller instructions wait for Trevor's approval, as descriptions do.
	await expect(dialog.locator('[data-part="assignment"] [data-field="instructions"]')).toHaveCount(
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
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 1');
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
			await expect(page.getByTestId('next-seat')).toHaveText(`Seat ${seat}`);
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
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 2');
	await page.getByRole('button', { name: 'Choose again' }).tap();
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 1');
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
	await expect(page.getByTestId('next-seat')).toHaveText('Seat 1');
	for (let n = 1; n <= 5; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		const reveal = page.getByTestId('reveal');
		// One token, both games' characters.
		await expect(reveal.getByTestId('reveal-face')).toHaveCount(2);
		await expect(reveal).toContainText('Town 1');
		await expect(reveal).toContainText('Town 2');
		if (n === 1) await reveal.getByLabel('Name').fill('Ana');
		await page.getByRole('button', { name: 'Confirm' }).tap();
		await expect(reveal).toBeHidden();
	}
	await expect(page.getByTestId('next-seat')).toHaveText('None');
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
	const menu = page.getByRole('dialog', { name: 'Game mode' });
	await expect(menu.getByRole('button', { name: 'Town 1 · Trouble Brewing' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await menu.getByRole('button', { name: 'Town 2 · Bad Moon Rising' }).tap();
	// Leaving the board asks first, as the app's navigation does; the game stays saved.
	await page
		.getByRole('alertdialog', { name: 'Leave the game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(page).not.toHaveURL(board);
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByTestId('script-title')).toContainText('Bad Moon Rising');
	await expect(page.getByText('Ana', { exact: true }).first()).toBeVisible();
	await page.getByTestId('mode-menu').tap();
	await page
		.getByRole('dialog', { name: 'Game mode' })
		.getByRole('button', { name: 'Towns' })
		.tap();
	// Leaving asks unless it was just confirmed (shell.ts keeps a short pass).
	const ask = page.getByRole('alertdialog', { name: 'Leave the game?' });
	await Promise.race([page.waitForURL(towns), ask.waitFor()]);
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page).toHaveURL(towns);
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
	await expect(panel.getByTestId('town-sizes')).toHaveText('Town 1: 5 players · Town 2: 5 players');
	await panel.getByRole('button', { name: 'Start game' }).tap();

	// "Boomdandy and Mayor are guaranteed to be in play": the Boomdandy in the Zombuul town,
	// the Mayor in the other, each already chosen when its setup opens. Town 1's setup opens
	// first, and its bag opens town 2's (Trevor, 2026-10-18).
	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByTestId('count-minion')).toHaveText('1');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
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
	await expect(dialog.getByRole('status')).toContainText('sources: must list at least one source');

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
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/extras$/);
	await expect(page.getByRole('heading', { name: 'Hidden characters', level: 1 })).toBeVisible();
	const extras = page.getByTestId('extras').locator('li');
	// Up to four: two Townsfolk, an Outsider and a Minion.
	await expect(extras).toHaveCount(4);
	await expect(extras.nth(0)).toContainText('Townsfolk');
	await expect(extras.nth(1)).toContainText('Townsfolk');
	await expect(extras.nth(2)).toContainText('Outsider');
	await expect(extras.nth(3)).toContainText('Minion');
	await expect(page.getByTestId('extras-range')).toHaveText(
		'Tell the table: 3 to 5 hidden characters'
	);
	// Rolling one again swaps it for another off-script character of the same type.
	const reroll = extras.nth(0).getByRole('button', { name: /^Roll again instead of / });
	const before = await reroll.getAttribute('aria-label');
	await reroll.tap();
	await expect(
		extras.nth(0).getByRole('button', { name: /^Roll again instead of / })
	).not.toHaveAttribute('aria-label', before!);
	// The Storyteller can choose the character, or leave a row empty.
	await extras.nth(2).getByRole('button', { name: 'Choose a hidden Outsider' }).tap();
	const picker = page.getByRole('dialog', { name: 'Choose a hidden Outsider' });
	await picker.getByRole('searchbox').fill('Goon');
	await picker.getByRole('button', { name: /^Goon\b/ }).tap();
	await expect(picker).toBeHidden();
	await expect(extras.nth(2)).toContainText('Goon');
	await extras.nth(3).getByRole('button', { name: 'Clear the hidden Minion' }).tap();
	await expect(extras.nth(3)).toContainText('None');
	await extras.nth(1).getByRole('button', { name: 'Clear the hidden Townsfolk' }).tap();
	await expect(page.getByTestId('extras-range')).toHaveText(
		'Tell the table: 1 to 3 hidden characters'
	);
	await noSidewaysScroll(page);

	await page.getByRole('button', { name: 'Choose characters' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	// Off the script but chosen for the bag: listed under their own types, marked (Trevor,
	// 2026-10-18).
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('count-minion')).toHaveText('0');
	const offScript = page.locator('.choice[data-off-script]');
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
	await expect(page).toHaveURL(/\/extras$/);
	const extras = page.getByTestId('extras').locator('li');
	await expect(extras).toHaveCount(4);
	// The roll fills at least one row.
	await expect(
		extras.getByRole('button', { name: /^Roll again instead of / }).first()
	).toBeVisible();
	for (const [i, type] of ['Townsfolk', 'Townsfolk', 'Outsider', 'Minion'].entries()) {
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
	// Apparition, from https://www.youtube.com/watch?v=-R34QbIgDh8
	await page.goto('/new');
	await chooseRules(page, 'Specters');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+/);
	const gameId = new URL(page.url()).pathname.split('/')[2];

	await page.goto(`/grimoire/${gameId}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const shareCode = page.getByTestId('share-code');
	await expect(shareCode).toHaveText(/^\s*\d{3}\s?\d{3}\s*$/);
	const code = (await shareCode.textContent())!.replace(/\s/g, '');

	// Specters opens over the board from the Game mode menu (Trevor, 2026-10-18: the grimoire
	// stays in reach). Before setup the corner has no room for the name, so ⋯ has it too.
	await page.goto(`/grimoire/${gameId}`);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Game mode' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Game mode' })
		.getByRole('button', { name: 'Specters vote and ability' })
		.tap();
	const sheet = page.getByRole('dialog', { name: 'Apparition' });
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

test('New game shows each script’s author and version under its name', async ({ page }) => {
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
	// In the script search's list (Trevor, 2026-10-19), on Standard and in a mode alike.
	const option = page.getByRole('option').filter({ hasText: 'Byline Test' });
	await page.getByRole('combobox', { name: 'Find a script' }).tap();
	await expect(option).toContainText('by Test Author');
	await expect(option).toContainText('2.1');
	await page.keyboard.press('Escape');
	await chooseMode(page, 'Flesh and Bone');
	await page.getByRole('combobox', { name: 'Find a script' }).tap();
	await expect(option).toContainText('by Test Author');
});

test('any script beyond the base three is found by typing, or picked in the Library', async ({
	page
}) => {
	// Trevor, 2026-10-19: easy to reach with 50 scripts.
	await page.goto('/new');
	const script = page.getByRole('radiogroup', { name: 'Script' });
	await expect(script.getByRole('radio')).toHaveCount(3);
	const search = page.getByRole('combobox', { name: 'Find a script' });
	await search.tap();
	await search.fill('no such script');
	await expect(page.getByRole('listbox')).toContainText('None');
	await page.getByRole('option', { name: 'Find more scripts online' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await page.goto('/new');
	await page.getByRole('button', { name: 'Choose from the Library' }).tap();
	await expect(page.getByRole('dialog', { name: 'Choose from the Library' })).toBeVisible();
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
	await expect(dialog.getByTestId('rule-conflicts')).toContainText(
		'Whale Buffet and A Script of Infinite Possibilities both set Character pool'
	);
	// Inspect shows a rule's own parts and its rule file.
	await dialog.getByRole('button', { name: 'Inspect A Script of Infinite Possibilities' }).tap();
	const inspect = page.getByRole('dialog', { name: 'A Script of Infinite Possibilities' });
	await expect(inspect.locator('li[data-part="pool"]')).toHaveAttribute('data-status', 'runs');
	await expect(inspect.getByRole('button', { name: 'Rule file', exact: true })).toBeVisible();
	await inspect.getByRole('button', { name: 'Close' }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await noSidewaysScroll(page);

	await modesPanel(page).getByRole('button', { name: 'Start game' }).tap();
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
