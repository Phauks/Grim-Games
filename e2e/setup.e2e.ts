import { expect, test, type Page } from '@playwright/test';
import { pickScript } from './new-game.ts';

// Character selection, the bag and the draw (ROADMAP Phase 2 Setup).

/** Starts a game of `script` with `players` seats and opens its character selection. */
async function selectionFor(page: Page, players: number, script = 'Trouble Brewing') {
	await page.goto('/new');
	await pickScript(page, script);
	for (let n = 8; n > players; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	for (let n = 8; n < players; n++) await page.getByRole('button', { name: 'More players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	await expect(page.getByTestId('player-count')).toHaveText(String(players));
}

test('the setup table is shown and follows the player count', async ({ page }) => {
	await selectionFor(page, 6);
	const table = page.getByTestId('setup-table');
	await expect(table).toBeVisible();
	const current = table.locator('thead [data-current]');
	await expect(current).toHaveText('6');
	await expect(table.locator('tbody [data-current]')).toHaveText(['3', '1', '1', '1']);
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(current).toHaveText('7');
	await expect(table.locator('tbody [data-current]')).toHaveText(['5', '0', '1', '1']);
	// Tapping a column sets the count too (Trevor, 2026-10-16), anywhere in the column.
	await table.locator('tbody tr[data-type="minion"] td').nth(5).tap();
	await expect(page.getByTestId('player-count')).toHaveText('10');
	await table.getByRole('button', { name: '5 players', exact: true }).tap();
	await expect(page.getByTestId('player-count')).toHaveText('5');
	await expect(table.getByRole('button', { name: '5 players', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('setup is one flow of two steps with the same bar on each', async ({ page }) => {
	await selectionFor(page, 5);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	// No step header: the bar at the bottom moves between the steps (Trevor, 2026-10-17).
	await expect(page.getByRole('navigation', { name: 'Setup steps' })).toHaveCount(0);
	// The bar: Back on the left, the step's main action on the right.
	const bar = page.getByRole('navigation', { name: 'Setup', exact: true });
	const barButtons = async () => {
		const [back, next] = await Promise.all([
			bar.getByRole('link').first().boundingBox(),
			bar.locator('a, button').last().boundingBox()
		]);
		expect(back!.x).toBeLessThan(next!.x);
		return { back, next };
	};
	await expect(bar.getByRole('link', { name: 'Grimoire' })).toBeVisible();
	await expect(bar.getByRole('button', { name: 'Build bag' })).toBeVisible();
	const onCharacters = await barButtons();

	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await expect(bar.getByRole('link', { name: 'Characters' })).toBeVisible();
	await expect(bar.getByRole('link', { name: 'Grimoire' })).toBeVisible();
	// Same place on both steps.
	const onDraw = await barButtons();
	expect(Math.abs(onDraw.back!.y - onCharacters.back!.y)).toBeLessThan(2);
	expect(
		Math.abs(
			onDraw.next!.x + onDraw.next!.width - (onCharacters.next!.x + onCharacters.next!.width)
		)
	).toBeLessThan(2);
	// Leaving the draw before every tile is drawn asks first (Trevor, 2026-10-16).
	const leave = page.getByRole('alertdialog', { name: 'Leave the draw?' });
	await bar.getByRole('link', { name: 'Characters' }).tap();
	await expect(leave).toContainText('Now: 5 of 5 tiles not yet drawn.');
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	await bar.getByRole('button', { name: 'Continue draw' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);

	// Once the draw has started, the way back stays on screen.
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('reveal')).toBeHidden();
	await expect(page.getByText(/\d+ left|Enter draws/)).toHaveCount(0);
	await bar.getByRole('link', { name: 'Characters' }).tap();
	await expect(leave).toContainText('Now: 4 of 5 tiles not yet drawn.');
	await leave.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await page.goBack();
	await expect(leave).toBeVisible();
	await leave.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await bar.getByRole('link', { name: 'Characters' }).tap();
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(`${board}/setup`);
	// Going back changes nothing: with the same characters, the button goes back to the same
	// draw (Trevor, 2026-10-17).
	await bar.getByRole('button', { name: 'Continue draw' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(1);
	await bar.getByRole('link', { name: 'Characters' }).tap();
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	// Other characters make a new bag: it asks first, and the old draw leaves the grimoire.
	await select(page, 'Monk', 'Chef');
	await bar.getByRole('button', { name: 'Build bag' }).tap();
	const replace = page.getByRole('alertdialog', { name: 'Replace the bag?' });
	await expect(replace).toContainText('Now: 1 of 5 tiles drawn.');
	await replace.getByRole('button', { name: 'Cancel' }).tap();
	await bar.getByRole('button', { name: 'Build bag' }).tap();
	await replace.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(`${board}/draw`);
	await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(0);
	// No "Next: Seat 1": the draw order is never shown (Trevor, 2026-10-19).
	await expect(page.getByTestId('next-seat')).toHaveCount(0);
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();

	// Finishing goes to the board, which opens its setup reminders.
	await bar.getByRole('link', { name: 'Grimoire' }).tap();
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(new RegExp(`${board}(#setup-reminders)?$`));
});

const choice = (page: Page, name: string) =>
	page.getByRole('button', { name, exact: true }).and(page.locator('[aria-pressed]'));

async function select(page: Page, ...names: string[]) {
	for (const name of names) await choice(page, name).tap();
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

// Trevor, 2026-10-17: the counts and search stay in view below the app header, never over it.
test('the counts and search stick just below the header while the list scrolls', async ({
	page
}) => {
	await selectionFor(page, 5);
	await page.mouse.wheel(0, 3000);
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	const header = (await page.getByRole('banner').boundingBox())!;
	const counts = page.getByTestId('setup-counts');
	await expect(counts).toBeInViewport();
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await expect(search).toBeInViewport();
	for (const box of [await counts.boundingBox(), await search.boundingBox()]) {
		expect(box!.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
	}
	// It really did scroll: the page heading is gone.
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).not.toBeInViewport();
});

test('selection counts against the setup sheet and explains the Drunk', async ({ page }) => {
	await selectionFor(page, 6);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Drunk', 'Poisoner', 'Imp');
	// Adding the Drunk asks nothing (Trevor, 2026-10-16): the Drunk has no token in the bag,
	// so the check asks for one more Townsfolk, and who is the Drunk is decided after the draw.
	await expect(page.getByRole('dialog')).toHaveCount(0);
	const check = page.getByTestId('setup-check');
	await expect(page.getByTestId('warning-count')).not.toHaveText('0');
	await expect(check).toContainText(/Drunk\s*: \+1 Townsfolk in the bag/);
	await select(page, 'Chef');
	await expect(choice(page, 'Drunk')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('4');
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('warning-count')).toHaveText('0');
	await noSidewaysScroll(page);

	// A Baron needs two more Outsiders: the counts and the check say so, but nothing blocks.
	await select(page, 'Baron');
	await expect(page.getByTestId('warning-count')).not.toHaveText('0');
	// The check is on the screen, not behind a button.
	await expect(page.getByRole('button', { name: /Check/ })).toHaveCount(0);
	await expect(check).toBeVisible();
	await expect(check).toContainText(/Baron\s*: \+2 Outsiders/);
	await select(page, 'Baron');

	// The selection is kept on the device.
	await page.reload();
	await expect(choice(page, 'Drunk')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('warning-count')).toHaveText('0');

	// Clear is an icon by the search and says what it discards before clearing.
	await page.getByRole('button', { name: 'Clear selection' }).tap();
	const clear = page.getByRole('alertdialog', { name: 'Clear the selection?' });
	await expect(clear).toContainText('Now: 7 characters chosen. After: none.');
	await clear.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await page.getByRole('button', { name: 'Random selection' }).tap();
	await expect(page.getByTestId('warning-count')).toHaveText('0');
});

test('characters can be searched by name or ability', async ({ page }) => {
	await selectionFor(page, 5);
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('pairs of EVIL');
	await expect(choice(page, 'Chef')).toBeVisible();
	await expect(choice(page, 'Imp')).toHaveCount(0);
	await search.press('Enter');
	await expect(search).not.toBeFocused();
	await choice(page, 'Chef').tap();
	await page.getByRole('button', { name: 'Clear search' }).tap();
	await expect(choice(page, 'Imp')).toBeVisible();
	await expect(choice(page, 'Chef')).toHaveAttribute('aria-pressed', 'true');
	await search.fill('zzzz');
	await expect(page.getByTestId('character-picker')).toHaveText('None');
});

// Trevor, 2026-10-19: with Stowed Away, "the 0-2 travelers should show themselves in the
// calculation". Rule: https://beardytas.com/garden-of-djinn/stowed-away/
test('Stowed Away: up to 2 Travellers count in the bag, the rest for fewer players', async ({
	page
}) => {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: /^Special rules/ }).tap();
	const rules = page.getByRole('dialog', { name: 'Special rules' });
	await rules.getByText('Stowed Away', { exact: true }).tap();
	await rules.getByRole('button', { name: 'Close' }).tap();
	await expect(rules).toBeHidden();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+/);
	const gameId = new URL(page.url()).pathname.split('/')[2];
	await page.goto(`/grimoire/${gameId}/setup`);
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();

	// The rule's Travellers are part of setup, so their section starts open.
	const header = page.getByRole('button', { name: 'Travellers', exact: true });
	await expect(header).toHaveAttribute('aria-expanded', 'true');
	const travellers = page.locator('[data-testid="setup-counts"] [data-type="traveller"]');
	await expect(travellers).toContainText('0/ 0–2');
	await expect(travellers).toHaveAttribute('data-ok', '');

	// Two Travellers: the other counts are for 6 players (https://wiki.bloodontheclocktower.com/Setup).
	await select(page, 'Scapegoat', 'Gunslinger');
	await expect(travellers).toContainText('2/ 0–2');
	await expect(travellers).toHaveAttribute('data-ok', '');
	await expect(page.locator('[data-testid="setup-counts"] [data-type="townsfolk"]')).toContainText(
		'/ 3'
	);
	// A third is more than the rule allows.
	await select(page, 'Beggar');
	await expect(travellers).not.toHaveAttribute('data-ok', '');
	await noSidewaysScroll(page);
});

// Trevor, 2026-10-18: Travellers in the bag, the recommended ones listed first and every
// other one found through a searchable dialog.
test("Travellers can join the bag: the edition's are listed, the rest are a search away", async ({
	page
}) => {
	await selectionFor(page, 8);
	// Rarely in play, so the section starts closed (Trevor, 2026-10-18); its header opens it.
	const header = page.getByRole('button', { name: 'Travellers', exact: true });
	await expect(header).toHaveAttribute('aria-expanded', 'false');
	await header.tap();
	// Trouble Brewing's own Travellers are listed without being on its sheet.
	await expect(choice(page, 'Scapegoat')).toBeVisible();
	await expect(choice(page, 'Harlot')).toHaveCount(0);
	await page.getByRole('button', { name: 'Add a Traveller' }).tap();
	const dialog = page.getByRole('dialog', { name: 'All Travellers' });
	await dialog.getByRole('searchbox').fill('Harlot');
	await dialog.getByRole('button', { name: /^Harlot/ }).tap();
	await expect(dialog.getByRole('button', { name: /^Harlot/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(choice(page, 'Harlot')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('li', { has: choice(page, 'Harlot') })).toContainText('Not on script');
	await expect(page.locator('li', { has: choice(page, 'Scapegoat') })).not.toContainText(
		'Not on script'
	);
	await expect(page.getByTestId('count-traveller')).toHaveText('1');
	await noSidewaysScroll(page);
});

// Trevor, 2026-10-18: Fabled and Loric on the Characters screen, closed at first; they join
// the game as rule characters, never the bag.
test('Fabled and Loric are added from their own closed sections, not to the bag', async ({
	page
}) => {
	await selectionFor(page, 8);
	for (const name of ['Fabled', 'Loric'])
		await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	await page.getByRole('button', { name: 'Add a Fabled' }).tap();
	const dialog = page.getByRole('dialog', { name: 'All Fabled' });
	await dialog.getByRole('searchbox').fill('Sentinel');
	await dialog.getByRole('button', { name: /^Sentinel/ }).tap();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	// Its section opens to show it.
	await expect(page.getByRole('button', { name: 'Fabled', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(choice(page, 'Sentinel')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('li', { has: choice(page, 'Sentinel') })).toContainText(
		'Not on script'
	);
	// In play as a rule character, so the bag's counts don't change.
	for (const type of ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'])
		await expect(page.getByTestId(`count-${type}`)).toHaveText('0');
	// A tap takes it out again, and it stays listed so that can be undone.
	await choice(page, 'Sentinel').tap();
	await expect(choice(page, 'Sentinel')).toHaveAttribute('aria-pressed', 'false');
	await noSidewaysScroll(page);
});

// Trevor, 2026-10-18: New game's count stopped at 15; stress tests need more players.
test('New game and character selection take more than 15 players', async ({ page }) => {
	await selectionFor(page, 24);
	// Beyond 15 the sheet's 15+ column applies (https://wiki.bloodontheclocktower.com/Setup).
	await expect(page.getByTestId('setup-table').locator('thead [data-current]')).toHaveText('15+');
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(page.getByTestId('player-count')).toHaveText('25');
});

// Trevor, 2026-10-18: with every Trouble Brewing character chosen for 20 players the bag
// holds 21 tiles (the Drunk shares a Townsfolk's); confirmed anyway, the last tile is drawn
// to a new seat rather than left in the bag.
test('a bag with more tiles than seats draws the extra tiles to new seats', async ({ page }) => {
	await selectionFor(page, 8);
	for (let n = 8; n < 20; n++) await page.getByRole('button', { name: 'More players' }).tap();
	await expect(page.getByTestId('player-count')).toHaveText('20');
	const names = await page
		.locator('main [aria-pressed][data-character-id]')
		.evaluateAll((els) =>
			els
				.filter(
					(el) => !el.closest('[data-type="traveller"], [data-type="fabled"], [data-type="loric"]')
				)
				.map((el) => el.getAttribute('aria-label') ?? '')
		);
	for (const name of names) await choice(page, name).tap();
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	const tiles = page.getByRole('button', { name: /^Tile \d+$/ });
	await expect(tiles).toHaveCount(21);
	for (let n = 1; n <= 20; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await page.getByRole('button', { name: 'Tile 21', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await noSidewaysScroll(page);
});

// Trevor, 2026-10-18: a button to list only the chosen characters, together with the search.
test('Show only selected lists just the chosen characters and still searches', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Chef', 'Empath', 'Imp');
	const only = page.getByRole('button', { name: 'Show only selected' });
	await only.tap();
	await expect(only).toHaveAttribute('aria-pressed', 'true');
	await expect(choice(page, 'Washerwoman')).toHaveCount(0);
	await expect(choice(page, 'Chef')).toBeVisible();
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('pairs of EVIL');
	await expect(choice(page, 'Chef')).toBeVisible();
	await expect(choice(page, 'Empath')).toHaveCount(0);
	await search.fill('');
	await only.tap();
	await expect(only).toHaveAttribute('aria-pressed', 'false');
	await expect(choice(page, 'Washerwoman')).toBeVisible();
	await noSidewaysScroll(page);
});

test('bag tiles show numbers, letters, symbols, colours, emoji or a random mix, centred on the token', async ({
	page
}) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	const tile = page.getByRole('button', { name: 'Tile 1', exact: true });
	await expect(tile).toHaveText('1');
	// The number's centre is the tile's centre.
	const [t, f] = await Promise.all([tile.boundingBox(), tile.locator('.face').boundingBox()]);
	expect(Math.abs(t!.x + t!.width / 2 - (f!.x + f!.width / 2))).toBeLessThan(2);
	expect(Math.abs(t!.y + t!.height / 2 - (f!.y + f!.height / 2))).toBeLessThan(2);

	// A dropdown, not a switch (Trevor, 2026-10-16).
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	await page.getByRole('button', { name: 'Storyteller', exact: true }).tap();
	await page.getByRole('combobox', { name: 'Bag tile labels' }).tap();
	await page.getByRole('option', { name: 'Letters' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Tile A', exact: true })).toHaveText('A');
	await expect(page.getByRole('button', { name: 'Tile E', exact: true })).toHaveText('E');

	// The same setting from the draw itself (Trevor, 2026-10-17), which shows the choice made
	// in Settings. Symbols, colours, or Random mixing everything, named in words.
	await page.getByRole('button', { name: 'Bag draw' }).tap();
	const here = page.getByTestId('bag-settings');
	await expect(here.getByRole('combobox', { name: 'Bag tile labels' })).toContainText('Letters');
	await page.keyboard.press('Escape');
	async function choose(option: string) {
		await page.getByRole('button', { name: 'Bag draw' }).tap();
		await page.getByTestId('bag-settings').getByRole('combobox', { name: 'Bag tile labels' }).tap();
		await page.getByRole('option', { name: option }).tap();
		await page.keyboard.press('Escape');
	}
	const bag = page.getByRole('list', { name: 'Bag' }).getByRole('button');
	// Roman numerals (Trevor, 2026-10-19).
	await choose('Roman numerals');
	await expect(page.getByRole('button', { name: 'Tile IV', exact: true })).toHaveText('IV');
	// None: blank tiles (Trevor, 2026-10-22).
	await choose('None');
	await expect(page.getByRole('button', { name: 'Tile 1', exact: true })).toHaveText('');
	await choose('Symbols');
	await expect(page.getByRole('button', { name: 'Tile Star', exact: true })).toBeVisible();
	await expect(bag.first().locator('[data-kind="symbol"] svg')).toBeVisible();
	// The symbol sits in the middle of the token (Trevor, 2026-10-17).
	for (const button of await bag.all()) {
		const [b, g] = await Promise.all([button.boundingBox(), button.locator('svg').boundingBox()]);
		expect(Math.abs(b!.x + b!.width / 2 - (g!.x + g!.width / 2))).toBeLessThan(1);
		expect(Math.abs(b!.y + b!.height / 2 - (g!.y + g!.height / 2))).toBeLessThan(1);
	}
	await choose('Colours');
	// The colour fills the whole token (Trevor, 2026-10-17).
	await expect(page.getByRole('button', { name: 'Tile Red', exact: true })).toHaveCSS(
		'background-color',
		'rgb(255, 0, 0)'
	);
	await choose('Emoji');
	await expect(page.getByRole('button', { name: 'Tile Apple', exact: true })).toContainText('🍎');
	await choose('Random');
	const labels = await bag.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
	expect(new Set(labels).size).toBe(5);
	await page.reload();
	await expect
		.poll(() => bag.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))))
		.toEqual(labels);
	await bag.first().tap();
	await expect(page.getByRole('dialog', { name: labels[0]! })).toBeVisible();
});

test('with Require a name, the token stays hidden until a name is typed', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	await page.getByRole('button', { name: 'Storyteller', exact: true }).tap();
	await page.getByText('Require a name before drawing', { exact: true }).tap();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal.getByTestId('reveal-locked')).toBeVisible();
	await expect(reveal.getByTestId('reveal-name')).toHaveText('');
	const show = page.getByRole('button', { name: 'Reveal' });
	await expect(show).toBeDisabled();
	await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
	await show.tap();
	await expect(reveal.getByTestId('reveal-name')).not.toBeEmpty();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 1, drawn' })).toBeDisabled();
});

test('the player picks their name from names used before, instead of typing', async ({ page }) => {
	// Trevor, 2026-10-19: on the pass-the-phone draw, "select your name from a list".
	await selectionFor(page, 5);
	await page.evaluate(() =>
		localStorage.setItem('grim-games:player-names:v1', JSON.stringify(['Ana', 'Ben']))
	);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	const reveal = page.getByTestId('reveal');
	await reveal.getByRole('button', { name: 'Pick your name' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Pick your name' });
	await expect(sheet.getByRole('button')).toHaveText(['Ana', 'Ben']);
	await sheet.getByRole('button', { name: 'Ben' }).tap();
	await expect(sheet).toBeHidden();
	await expect(reveal.getByRole('textbox', { name: 'Name' })).toHaveValue('Ben');
	await page.getByRole('button', { name: 'Confirm' }).tap();

	// Ben has a seat now, so the next player is offered Ana only.
	await page.getByRole('button', { name: 'Tile 2', exact: true }).tap();
	await reveal.getByRole('button', { name: 'Pick your name' }).tap();
	await expect(sheet.getByRole('button')).toHaveText(['Ana']);
	await sheet.getByRole('button', { name: 'Ana' }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 2, drawn' })).toBeDisabled();
});

test('type groups and the setup sheet close from their header and stay closed', async ({
	page
}) => {
	await selectionFor(page, 5);
	const townsfolk = page.getByRole('button', { name: 'Townsfolk', exact: true });
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'true');
	await townsfolk.tap();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
	await expect(choice(page, 'Chef')).toBeHidden();
	await page.getByRole('button', { name: 'Setup sheet', exact: true }).tap();
	await expect(page.getByTestId('setup-table')).toBeHidden();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Townsfolk', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await expect(page.getByTestId('setup-table')).toBeHidden();
	await expect(choice(page, 'Imp')).toBeVisible();
});

test('a character picked by Random looks the same as one picked by hand', async ({ page }) => {
	await selectionFor(page, 5);
	await page.getByRole('button', { name: 'Random selection' }).tap();
	const picked = page.locator('.row[data-chosen]');
	await expect(picked.first()).toBeVisible();
	const random = picked.first();
	const randomName = await random.locator('.main').getAttribute('data-character-id');
	// Pick one by hand: clear, then tap the same character.
	await page.getByRole('button', { name: 'Clear selection' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await page.locator(`[data-character-id="${randomName}"]`).tap();
	const manual = page.locator('.row[data-chosen]').first();
	const ring = (l: typeof manual) =>
		l.evaluate((el) => {
			const after = getComputedStyle(el, '::after');
			return { ring: after.boxShadow, bg: getComputedStyle(el).backgroundColor };
		});
	// Move the pointer away so a hover can't differ either.
	await page.mouse.move(0, 0);
	const byHand = await ring(manual);
	await page.getByRole('button', { name: 'Random selection' }).tap();
	await page.mouse.move(0, 0);
	const byRandom = await ring(page.locator('.row[data-chosen]').first());
	expect(byHand).toEqual(byRandom);
	expect(byHand.ring).not.toBe('none');
});

test('building a bag with errors asks the Storyteller to confirm them', async ({ page }) => {
	await selectionFor(page, 5);
	// No Demon, and one character short.
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	const errors = page.getByTestId('build-errors');
	await expect(errors).toBeVisible();
	await expect(errors).toContainText('4 characters chosen for 5 players');
	await page.getByRole('button', { name: 'Cancel' }).tap();
	await expect(errors).toBeHidden();
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	await expect(page.getByRole('list', { name: 'Bag' }).getByRole('listitem')).toHaveCount(4);
});

test('the draw reveals tiles, keeps a held tile and lands on seats', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page).toHaveURL(/\/draw$/);
	await expect(page.getByRole('list', { name: 'Bag' }).getByRole('listitem')).toHaveCount(5);

	// Tile 1 to seat 1, with a name.
	await page.getByRole('button', { name: 'Tile 1', exact: true }).tap();
	const reveal = page.getByTestId('reveal');
	await expect(reveal).toBeVisible();
	await expect(reveal.getByTestId('reveal-name')).not.toBeEmpty();
	// The token never covers the name or the ability (Trevor, 2026-10-17).
	const token = (await reveal.getByRole('img').first().boundingBox())!;
	const caption = (await reveal.getByTestId('reveal-name').boundingBox())!;
	expect(token.y + token.height).toBeLessThanOrEqual(caption.y + 1);
	await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 1, drawn' })).toBeDisabled();

	// A drawn tile is never put back: closing the reveal keeps it in seat 2's hand, even
	// across a reload.
	await page.getByRole('button', { name: 'Tile 2', exact: true }).tap();
	await expect(reveal).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(reveal).toBeHidden();
	await page.reload();
	const held = page.getByRole('button', { name: 'Tile 2, held by Seat 2' });
	await expect(held).toBeVisible();
	await held.tap();
	await expect(page.getByRole('button', { name: 'Put back' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Tile 2, drawn' })).toBeDisabled();

	// The rest are drawn one by one; Enter in the name field closes the keyboard, not the reveal.
	for (let n = 3; n <= 5; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		const name = reveal.getByRole('textbox', { name: 'Name' });
		await expect(name).toHaveAttribute('enterkeyhint', 'done');
		await name.fill(`P${n}`);
		await name.press('Enter');
		await expect(name).not.toBeFocused();
		await expect(reveal).toBeVisible();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await expect(page.getByRole('button', { name: 'Add all' })).toHaveCount(0);
	await noSidewaysScroll(page);

	// The last step is the board's setup reminders tray, not a list in the draw.
	await page
		.getByRole('navigation', { name: 'Setup', exact: true })
		.getByRole('link', { name: 'Grimoire' })
		.tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+(#setup-reminders)?$/);
	await expect(page.getByRole('button', { name: /^Seat 1: Ana, / })).toBeVisible();
	for (let n = 1; n <= 5; n++) {
		await expect(page.getByRole('button', { name: new RegExp(`^Seat ${n}: .+`) })).toBeVisible();
	}

	// Set up: the bag and the selection are gone from the board, and closed by address.
	await expect(page.getByRole('button', { name: 'Characters' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Bag draw' })).toHaveCount(0);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/draw`);
	await expect(page).toHaveURL(new RegExp(`${board}$`));
});

test.describe('in a computer window', () => {
	test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

	test('controls sit beside the list, and the keyboard reaches search and the draw', async ({
		page
	}) => {
		await page.goto('/new');
		await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').click();
		for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).click();
		await page.getByRole('button', { name: 'Start game' }).click();
		await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
		await page.goto(`${new URL(page.url()).pathname}/setup`);

		// The setup sheet is beside the characters; Build bag is in the bar at the bottom right.
		const sheet = await page.getByTestId('setup-table').boundingBox();
		const build = await page.getByRole('button', { name: 'Build bag' }).boundingBox();
		const list = await page.getByTestId('character-picker').boundingBox();
		expect(sheet!.x + sheet!.width).toBeLessThan(list!.x);
		expect(build!.x).toBeGreaterThan(list!.x + list!.width / 2);
		expect(build!.y + build!.height).toBeGreaterThan(900 - 2 * build!.height);
		expect(list!.y).toBeLessThan(sheet!.y + sheet!.height);
		await noSidewaysScroll(page);

		// "/" jumps to search; Esc clears it.
		const search = page.getByRole('searchbox', { name: 'Search characters' });
		await page.keyboard.press('/');
		await expect(search).toBeFocused();
		await page.keyboard.type('imp');
		await expect(choice(page, 'Chef')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(search).toHaveValue('');
		await expect(choice(page, 'Chef')).toBeVisible();

		for (const name of ['Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp'])
			await choice(page, name).click();
		await page.getByRole('button', { name: 'Build bag' }).click();
		await expect(page).toHaveURL(/\/draw$/);
		await noSidewaysScroll(page);

		// Enter draws a tile; Enter again confirms it.
		await page.keyboard.press('Enter');
		const reveal = page.getByTestId('reveal');
		await expect(reveal).toBeVisible();
		await reveal.getByRole('textbox', { name: 'Name' }).fill('Ana');
		await page.keyboard.press('Enter');
		await expect(reveal.getByRole('textbox', { name: 'Name' })).not.toBeFocused();
		await page.keyboard.press('Enter');
		await expect(reveal).toBeHidden();
		// Enter takes a tile at random, so any one of them is now drawn.
		await expect(page.getByRole('button', { name: /^Tile \d, drawn$/ })).toHaveCount(1);
	});
});

// https://wiki.bloodontheclocktower.com/Drunk: the Drunk has no token in the bag; one more
// Townsfolk goes in, and the Storyteller marks who is the Drunk once the tokens come back
// (Trevor, 2026-10-16).
test('a Drunk game draws only Townsfolk tokens and offers Is The Drunk on the board', async ({
	page
}) => {
	await selectionFor(page, 6);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Chef', 'Drunk', 'Poisoner', 'Imp');
	await expect(page.getByTestId('warning-count')).toHaveText('0');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page.getByRole('button', { name: /^Tile \d$/ })).toHaveCount(6);
	for (let n = 1; n <= 6; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		await expect(page.getByTestId('reveal')).not.toContainText('Drunk');
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await page
		.getByRole('navigation', { name: 'Setup', exact: true })
		.getByRole('link', { name: 'Grimoire' })
		.tap();
	await expect(page.getByText('Is The Drunk')).toBeVisible();
});

// The No Dashii's Townsfolk neighbours are poisoned from setup (Trevor, 2026-10-17;
// https://wiki.bloodontheclocktower.com/No_Dashii): the board offers both tokens after the draw.
test('a No Dashii game offers its two Poisoned tokens on the board after the draw', async ({
	page
}) => {
	await selectionFor(page, 5, 'Sects & Violets');
	await select(page, 'Clockmaker', 'Dreamer', 'Mathematician', 'Witch', 'No Dashii');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	for (let n = 1; n <= 5; n++) {
		await page.getByRole('button', { name: `Tile ${n}`, exact: true }).tap();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await page
		.getByRole('navigation', { name: 'Setup', exact: true })
		.getByRole('link', { name: 'Grimoire' })
		.tap();
	await expect(
		page
			.getByRole('list', { name: 'Reminder bank' })
			.getByRole('button', { name: 'Poisoned reminder' })
	).toHaveCount(2);
});

// Trevor, 2026-10-16: share the join code from setup, before the draw.
test("setup opens the players' join code and QR", async ({ page }) => {
	await selectionFor(page, 5);
	await page.getByRole('button', { name: 'Share' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Share' });
	await expect(dialog.getByTestId('share-code')).toHaveText(/\d/);
	await expect(dialog.getByRole('img', { name: /QR/i })).toBeVisible();
});

// Factual script checks from the Ravenswood Studio review (Trevor, 2026-10-16): jinxed pairs
// in play, and a Choirboy whose King isn't on the script can't be fixed by a swap
// (https://wiki.bloodontheclocktower.com/Choirboy). Warnings only.
test('the setup check lists jinxed pairs in play and says when a required character is off the script', async ({
	page
}) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste
		.getByLabel('Script JSON')
		.fill(
			JSON.stringify([
				{ id: '_meta', name: 'Jinx Check' },
				'choirboy',
				'chef',
				'empath',
				'magician',
				'spy',
				'imp'
			])
		);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Jinx Check');

	await page.goto('/new');
	await pickScript(page, 'Jinx Check');
	for (let n = 8; n > 5; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);

	const check = page.getByTestId('setup-check');
	for (const name of ['Choirboy', 'Magician', 'Spy', 'Imp'])
		await page.getByRole('button', { name, exact: true }).tap();
	await expect(check).toContainText(/Magician\s*and\s*Spy/);
	// Each jinxed character shows its partner's icon where a star used to be (Trevor, 2026-10-19).
	const partners = (id: string) =>
		page.locator(`.row:has([data-character-id="${id}"]) [data-testid="jinx-partners"]`);
	await expect(partners('magician').locator('[data-partner]')).toHaveAttribute(
		'data-partner',
		'spy'
	);
	await expect(partners('magician')).toHaveAttribute('title', 'Jinxed with Spy');
	await expect(partners('spy').locator('[data-partner]')).toHaveAttribute(
		'data-partner',
		'magician'
	);
	await expect(partners('choirboy').locator('[data-partner]')).toHaveCount(0);
	// No Djinn line: jinxes are enough (Trevor, 2026-10-17).
	await expect(check).not.toContainText('Djinn');
	await expect(check).toContainText(
		'Choirboy needs the King in play, but the King is not on the script.'
	);
	// The Warnings list says it once, without the swap advice it gives when the King is there.
	await expect(check.locator('.warn li').filter({ hasText: 'swap a Townsfolk' })).toHaveCount(0);
});

// Setup reminders come from our list of official characters, and script JSON doesn't say
// which reminders go out before the game, so a chosen custom character with reminders is
// named in the Warnings (Trevor, 2026-10-17). One without reminders has nothing to place.
test('the setup check names chosen custom characters whose setup reminders it cannot work out', async ({
	page
}) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste.getByLabel('Script JSON').fill(
		JSON.stringify([
			{ id: '_meta', name: 'Custom Check' },
			{
				id: 'lamplighter',
				name: 'Lamplighter',
				team: 'townsfolk',
				ability: 'Each night, learn something.',
				reminders: ['Lit']
			},
			{ id: 'quietone', name: 'Quiet One', team: 'townsfolk', ability: 'You do nothing.' },
			'chef',
			'empath',
			'spy',
			'imp'
		])
	);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Custom Check');

	await page.goto('/new');
	await pickScript(page, 'Custom Check');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);

	const check = page.getByTestId('setup-check');
	const custom = check.getByTestId('custom-reminders');
	await page.getByRole('button', { name: 'Quiet One', exact: true }).tap();
	await expect(custom).toHaveCount(0);
	await page.getByRole('button', { name: 'Lamplighter', exact: true }).tap();
	await expect(custom).toContainText('Lamplighter');
	await expect(custom).not.toContainText('Quiet One');
	// The badge in the warning is a button too: deselect from the character list.
	await page
		.getByRole('button', { name: 'Lamplighter', exact: true })
		.and(page.locator(':not([data-testid="setup-check"] *)'))
		.tap();
	await expect(custom).toHaveCount(0);
});

// Check sections showing None start closed, and open as soon as something appears (Trevor,
// 2026-10-18).
test('empty setup check sections are closed and open when something appears', async ({ page }) => {
	await selectionFor(page, 8);
	const check = page.getByTestId('setup-check');
	const jinxes = check.getByRole('button', { name: 'Jinxes' });
	await expect(jinxes).toHaveAttribute('aria-expanded', 'false');
	const warnings = check.getByRole('button', { name: 'Warnings' });
	await expect(warnings).toHaveAttribute('aria-expanded', 'false');
	await page.getByRole('button', { name: 'Imp', exact: true }).tap();
	await expect(warnings).toHaveAttribute('aria-expanded', 'true');
	await expect(check.locator('.warn li').first()).toBeVisible();
});

// The icon opens the character's page; the rest of the row still chooses it (Trevor,
// 2026-10-18).
test("tapping a character's icon opens its page without choosing it", async ({ page }) => {
	await selectionFor(page, 8);
	await page.getByRole('button', { name: 'About the Imp' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Imp' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('button', { name: 'Imp', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await page.getByRole('button', { name: 'Imp', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Imp', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('the Demon bluffs are chosen on the Characters screen, not the Draw', async ({ page }) => {
	// Trevor, 2026-10-18: where the Storyteller picks characters, not the screen players use.
	await selectionFor(page, 5);
	const bluffs = page.getByTestId('setup-bluffs');
	// There and usable before anything is chosen (Trevor, 2026-10-18), so it never pops in.
	await expect(bluffs).toContainText('None');
	await expect(bluffs.getByRole('button', { name: 'Choose' })).toBeEnabled();
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await bluffs.getByRole('button', { name: 'Choose' }).tap();
	await page.getByTestId('bluff-set').first().getByRole('button', { name: 'Choose' }).tap();
	const choices = page.getByRole('group', { name: 'Bluff characters' });
	// Characters in play are hidden at first (Trevor, 2026-10-20); shown, they are marked.
	await expect(choices.getByRole('button', { name: /^Empath/ })).toHaveCount(0);
	await page.getByText('Not in play only', { exact: true }).tap();
	await expect(choices.getByRole('button', { name: /^Empath/ })).toContainText('In play');
	// Three empty places wait at the top, so choosing never pushes the list (Trevor, 2026-10-20).
	const chosen = page.getByRole('list', { name: 'Chosen' });
	await expect(chosen.getByRole('listitem', { includeHidden: true })).toHaveCount(3);
	// The places' height, as the list may scroll to bring a choice into view.
	const placesHeight = async () => (await chosen.boundingBox())!.height;
	const before = await placesHeight();
	for (const name of ['Fortune Teller', 'Soldier', 'Ravenkeeper']) {
		await choices.getByRole('button', { name: new RegExp(`^${name}`) }).tap();
		expect(await placesHeight()).toBeCloseTo(before, 0);
	}
	// Each chosen like a row of the list: token, name and ability, within the screen.
	await expect(chosen.getByRole('button', { name: 'Remove Soldier' })).toContainText(
		'You are safe from the Demon.'
	);
	const width = page.viewportSize()!.width;
	for (const place of await chosen.getByRole('listitem').all())
		expect((await place.boundingBox())!.x + (await place.boundingBox())!.width).toBeLessThanOrEqual(
			width
		);
	await chosen.getByRole('button', { name: 'Remove Soldier' }).tap();
	expect(await placesHeight()).toBeCloseTo(before, 0);
	await choices.getByRole('button', { name: /^Soldier/ }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	// The set lists each bluff as the script does, its ability under its name (Trevor, 2026-10-20).
	await expect(page.getByTestId('bluff-set').first()).toContainText('You are safe from the Demon.');
	await page.keyboard.press('Escape');
	// Each bluff like a character in the list: name and ability (Trevor, 2026-10-19).
	for (const name of ['Fortune Teller', 'Soldier', 'Ravenkeeper'])
		await expect(bluffs).toContainText(name);
	await expect(bluffs).toContainText('You are safe from the Demon.');
	// Change sits on the heading's line.
	const change = bluffs.getByRole('button', { name: 'Change' });
	await expect(change).toBeEnabled();
	const title = (await bluffs.getByRole('heading', { name: 'Demon bluffs' }).boundingBox())!;
	const button = (await change.boundingBox())!;
	expect(button.y + button.height / 2).toBeGreaterThan(title.y);
	expect(button.y + button.height / 2).toBeLessThan(title.y + title.height + button.height / 2);
	// Each bluff is tagged in the list above, and stays out of the bag (Trevor, 2026-10-18).
	await expect(page.getByTestId('bluff-tag')).toHaveCount(3);
	await expect(choice(page, 'Soldier')).toHaveAccessibleDescription('Demon bluff');
	await expect(choice(page, 'Soldier')).toHaveAttribute('aria-pressed', 'false');
	await expect(choice(page, 'Empath').getByTestId('bluff-tag')).toHaveCount(0);
	// A bluff then chosen for the bag is flagged, not dropped (warn, don't lock).
	await choice(page, 'Soldier').tap();
	await expect(choice(page, 'Soldier')).toHaveAccessibleDescription('Demon bluff, in play');
	await expect(choice(page, 'Soldier').getByTestId('bluff-tag')).toBeVisible();
	await expect(bluffs).toContainText('Soldier');
	await choice(page, 'Soldier').tap();
	await noSidewaysScroll(page);
	// The Draw screen has none.
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page.getByRole('heading', { name: 'Draw', level: 1 })).toBeVisible();
	await expect(page.getByTestId('setup-bluffs')).toHaveCount(0);
});

// Trevor, 2026-10-19: the bag's cog and Share sit on the Draw heading's line, at the right.
test('Draw keeps its cog and Share on the heading line', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	const heading = page.getByRole('heading', { name: 'Draw', level: 1 });
	await expect(heading).toBeVisible();
	const title = (await heading.boundingBox())!;
	const buttons = page.locator('main header').getByRole('button');
	await expect(buttons.first()).toBeVisible();
	for (const button of await buttons.all()) {
		const box = (await button.boundingBox())!;
		const middle = box.y + box.height / 2;
		expect(middle).toBeGreaterThan(title.y);
		expect(middle).toBeLessThan(title.y + title.height);
		expect(box.x).toBeGreaterThan(title.x);
	}
	await noSidewaysScroll(page);
});

test('Random picks three Demon bluffs, none in play', async ({ page }) => {
	// Trevor, 2026-10-18: the same Random button as setup's.
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	const bluffs = page.getByTestId('setup-bluffs');
	await bluffs.getByRole('button', { name: 'Choose' }).tap();
	await page.getByTestId('bluff-set').first().getByRole('button', { name: 'Choose' }).tap();
	await expect(page.getByRole('heading', { name: 'Demon bluffs · 0/3' })).toBeVisible();
	// Trevor, 2026-10-19: good characters only, and a toggle, on at first (2026-10-20), hides
	// those in play.
	const choices = page.getByRole('group', { name: 'Bluff characters' });
	await expect(choices.getByRole('button', { name: /^Poisoner/ })).toHaveCount(0);
	await expect(choices.getByRole('button', { name: /^Empath/ })).toHaveCount(0);
	await expect(choices.getByRole('button', { name: /^Chef/ })).toBeVisible();
	await page.getByText('Not in play only', { exact: true }).tap();
	await expect(choices.getByRole('button', { name: /^Empath/ })).toBeVisible();
	await page.getByText('Not in play only', { exact: true }).tap();
	await expect(choices.getByRole('button', { name: /^Empath/ })).toHaveCount(0);
	await page.getByRole('button', { name: 'Random', exact: true }).tap();
	await expect(page.getByRole('heading', { name: 'Demon bluffs · 3/3' })).toBeVisible();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	// No in-play warning to confirm: none of them is in play.
	await expect(page.getByRole('heading', { name: 'Save bluffs that are in play?' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	const picked = bluffs.locator('[data-character-id]');
	await expect(picked).toHaveCount(3);
	const ids = await picked.evaluateAll((els) =>
		els.map((el) => el.getAttribute('data-character-id'))
	);
	for (const id of ['washerwoman', 'empath', 'monk', 'poisoner', 'imp'])
		expect(ids).not.toContain(id);
	await noSidewaysScroll(page);
});

// Teensyville scripts are for 5 or 6 players (https://wiki.bloodontheclocktower.com/Teensyville):
// larger counts are greyed out on New game and setup but stay pickable (Trevor, 2026-10-19).
test('a Teensyville script greys out player counts above 6 but still allows them', async ({
	page
}) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste
		.getByLabel('Script JSON')
		.fill(
			JSON.stringify([
				{ id: '_meta', name: 'Tiny Town' },
				...['washerwoman', 'chef', 'empath', 'monk', 'soldier', 'mayor'],
				...['drunk', 'saint', 'poisoner', 'spy', 'imp', 'nodashii']
			])
		);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Tiny Town');

	await page.goto('/new');
	await pickScript(page, 'Tiny Town');
	const table = page.getByTestId('setup-table');
	await expect(table.locator('thead th[data-too-many]')).toHaveCount(9);
	await expect(table.locator('thead th[scope="col"]').nth(1)).not.toHaveAttribute('data-too-many');
	// Still pickable: 8 players stays chosen.
	await expect(page.getByTestId('player-count')).toHaveText('8');
	for (let n = 8; n > 6; n--) await page.getByRole('button', { name: 'Fewer players' }).tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await expect(table.locator('thead th[data-too-many]')).toHaveCount(9);
	await page.getByRole('button', { name: 'More players' }).tap();
	await expect(page.getByTestId('player-count')).toHaveText('7');
	await expect(page.getByText('This script is made for at most 6 players.')).toBeVisible();
	await expect(page.getByTestId('setup-check')).toContainText('Teensyville');
});

// Trevor, 2026-10-19: the locked pass-the-phone draw. A Storyteller PIN keeps players from
// leaving the draw, the token shows only while held, and a reload stays locked.
async function lockDraw(page: Page, pin = '2468') {
	await page.getByTestId('draw-lock').tap();
	const dialog = page.getByRole('dialog', { name: 'Lock the draw' });
	await dialog.getByLabel('PIN', { exact: true }).fill(pin);
	await dialog.getByLabel('PIN again').fill(pin);
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('draw-lock')).toHaveAttribute('aria-pressed', 'true');
}

async function lockedDraw(page: Page) {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page.getByRole('heading', { name: 'Draw', level: 1 })).toBeVisible();
	await lockDraw(page);
}

// Trevor (2026-10-20, Pixel): the footer was cut off under the Draw page's bottom bar.
test('the page footer clears the bottom bar on the setup steps', async ({ page }) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await expect(page.getByRole('heading', { name: 'Draw', level: 1 })).toBeVisible();
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	const footer = await page.getByRole('contentinfo').boundingBox();
	const bar = await page.locator('.setup-nav').boundingBox();
	expect(footer && bar && footer.y + footer.height).toBeLessThanOrEqual(bar!.y + 1);
});

test('a locked draw asks for the PIN to unlock and shows tokens only while held', async ({
	page
}) => {
	await lockedDraw(page);
	await expect(page.getByRole('button', { name: 'Bag draw' })).toHaveCount(0);
	// Locked: the script's logo and name in place of "Draw", and no Characters or Grimoire.
	const title = page.getByRole('heading', { level: 1 });
	await expect(title).toHaveText('Trouble Brewing');
	await expect(title.getByTestId('script-logo')).toHaveCount(1);
	await expect(page.locator('.setup-nav')).toHaveCount(0);
	// No header, sidebar or footer to leave by while the phone is passed round.
	await expect(page.getByRole('banner')).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Menu', exact: true })).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);

	// Hold to see character is off by default, locked or not (Trevor, 2026-10-20).
	await page.getByRole('button', { name: /^Tile 1/ }).tap();
	const reveal = page.getByRole('dialog', { name: /^Tile/ });
	await expect(reveal.getByTestId('reveal-hold')).toHaveCount(0);
	await expect(reveal.getByTestId('reveal-name')).not.toBeEmpty();
	await reveal.getByRole('button', { name: 'Confirm' }).tap();

	// A reload is still locked.
	await page.reload();
	await expect(page.getByTestId('draw-lock')).toHaveAttribute('aria-pressed', 'true');

	// Unlocking asks for the PIN; a wrong one keeps the draw locked.
	await page.getByTestId('draw-lock').tap();
	const pin = page.getByRole('dialog', { name: 'Enter the Storyteller PIN' });
	await pin.getByLabel('PIN', { exact: true }).fill('1111');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(pin.getByTestId('pin-message')).toHaveText('Wrong PIN.');
	await expect(page.getByTestId('draw-lock')).toHaveAttribute('aria-pressed', 'true');
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(title).toHaveText('Draw');
	await page.locator('.setup-nav').getByRole('link', { name: 'Characters' }).tap();
	// Unlocked, tiles still in the bag ask the usual question.
	await page
		.getByRole('alertdialog', { name: 'Leave the draw?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	// Unlocked: the header is back.
	await expect(page.getByRole('banner')).toBeVisible();
	await noSidewaysScroll(page);
});

test('three wrong PINs make entry wait', async ({ page }) => {
	await lockedDraw(page);
	await page.getByTestId('draw-lock').tap();
	const pin = page.getByRole('dialog', { name: 'Enter the Storyteller PIN' });
	for (let n = 0; n < 3; n++) {
		await pin.getByLabel('PIN', { exact: true }).fill('0000');
		await pin.getByRole('button', { name: 'Confirm' }).tap();
		await expect(pin.getByLabel('PIN', { exact: true })).toHaveValue('');
	}
	await expect(pin.getByTestId('pin-message')).toHaveText(/^Try again in (30|29) seconds\.$/);
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await expect(pin.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	// Forgot PIN counts down where everyone can see it, and can be stopped.
	await pin.getByRole('button', { name: 'Forgot PIN' }).tap();
	await expect(pin.getByTestId('pin-message')).toHaveText(/^Unlocking in (60|59) seconds\.$/);
	await pin.getByRole('button', { name: 'Keep locked' }).tap();
	await expect(pin.getByTestId('pin-message')).toHaveText(/^Try again in/);
});

test('locked characters stay in play through Random and are remembered', async ({ page }) => {
	await selectionFor(page, 9);
	const choice = (id: string) => page.locator(`.main[data-character-id="${id}"]`);
	const row = (id: string) => page.locator('.row', { has: choice(id) });
	const lock = (id: string) => row(id).getByTestId('lock-character');
	// Unselected: the lock is in place, unlocked (tapping it chooses the character too).
	await expect(lock('baron')).toHaveAttribute('aria-pressed', 'false');
	for (const id of ['baron', 'drunk']) {
		await choice(id).tap();
		await lock(id).tap();
		await expect(lock(id)).toHaveAttribute('aria-pressed', 'true');
	}
	for (let i = 0; i < 5; i++) {
		await page.getByRole('button', { name: 'Random selection' }).tap();
		for (const id of ['baron', 'drunk']) {
			await expect(row(id)).toHaveAttribute('data-chosen', '');
			await expect(lock(id)).toHaveAttribute('aria-pressed', 'true');
		}
	}
	await page.reload();
	await expect(lock('drunk')).toHaveAttribute('aria-pressed', 'true');
	// A lock holds against taps and Clear too (Trevor, 2026-10-22); unlocking lets it go.
	await choice('baron').tap();
	await expect(choice('baron')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByText('Unlock this character to take it out.')).toBeVisible();
	await page.getByRole('button', { name: 'Clear selection' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	for (const id of ['baron', 'drunk']) await expect(row(id)).toHaveAttribute('data-chosen', '');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await lock('baron').tap();
	await expect(lock('baron')).toHaveAttribute('aria-pressed', 'false');
	await choice('baron').tap();
	await expect(choice('baron')).toHaveAttribute('aria-pressed', 'false');
});

for (const width of [undefined, 1400]) {
	test(`the counts stay above the characters, each type's heading pinned under them${width ? ' on a computer window' : ''}`, async ({
		page
	}) => {
		// Trevor (2026-10-22): a computer window works as phones do.
		if (width) await page.setViewportSize({ width, height: 900 });
		await selectionFor(page, 8);
		const band = page.getByTestId('selection-band');
		const heading = page.locator('.collapsible > .head', { hasText: 'Townsfolk' });
		// Scroll the heading's group past the band's bottom edge.
		await heading.evaluate((h) => window.scrollBy(0, h.getBoundingClientRect().top + 200));
		await page.evaluate(() => new Promise(requestAnimationFrame));
		const [b, h] = await Promise.all([band.boundingBox(), heading.boundingBox()]);
		// The band is in view, and the heading sits just under it.
		expect(b!.y).toBeGreaterThanOrEqual(0);
		expect(h!.y).toBeGreaterThanOrEqual(b!.y + b!.height - 2);
		expect(h!.y).toBeLessThan(b!.y + b!.height + 20);
		// Search and its tools sit over the characters, not in the side column.
		const search = await page.getByRole('searchbox').boundingBox();
		const list = await page.locator('.main[data-character-id="imp"]').boundingBox();
		expect(search!.x + search!.width).toBeGreaterThan(list!.x);
	});
}

test('the board stays locked while the draw is, until the Storyteller PIN', async ({ page }) => {
	// Trevor (2026-10-19): with the phone passed round, opening the game's grimoire (by its
	// address, or a reload there) shows a lock screen, never the board.
	await lockedDraw(page);
	const draw = page.url();
	await page.goto(draw.replace(/\/draw$/, ''));
	const locked = page.getByTestId('board-locked');
	await expect(locked).toContainText('The grimoire is locked');
	await expect(page.getByTestId('seat')).toHaveCount(0);
	await expect(page.getByRole('banner')).toHaveCount(0);

	// Back to the draw is always there; the PIN opens the board.
	await expect(locked.getByRole('link', { name: 'Back to the draw' })).toBeVisible();
	await locked.getByRole('button', { name: 'Unlock the draw' }).tap();
	const pin = page.getByRole('dialog', { name: 'Enter the Storyteller PIN' });
	await pin.getByLabel('PIN', { exact: true }).fill('2468');
	await pin.getByRole('button', { name: 'Confirm' }).tap();
	await expect(locked).toHaveCount(0);
	await expect(page.getByTestId('seat')).toHaveCount(5);
});

// Trevor, 2026-10-19: the setup check folds into one Verification section, and a chosen
// character whose token stays out of the bag (the Drunk) is tagged by its check.
test('Verification folds the setup check away, and the Drunk is tagged not in bag', async ({
	page
}) => {
	await selectionFor(page, 7);
	const check = page.getByTestId('setup-check');
	const verification = check.getByRole('button', { name: 'Verification' });
	await expect(check.getByRole('button', { name: 'Warnings' })).toBeVisible();
	await verification.tap();
	await expect(check.getByRole('button', { name: 'Warnings' })).toBeHidden();
	await verification.tap();
	await expect(check.getByRole('button', { name: 'Jinxes' })).toBeVisible();

	const row = (id: string) =>
		page.locator('.row', { has: page.locator(`.main[data-character-id="${id}"]`) });
	await page.locator('.main[data-character-id="drunk"]').tap();
	await page.locator('.main[data-character-id="empath"]').tap();
	await expect(row('drunk').getByTestId('not-in-bag')).toHaveText('Not in bag');
	await expect(row('empath').getByTestId('not-in-bag')).toHaveCount(0);
	// Every part has its count, and Verification's is their total (Trevor, 2026-10-20).
	const parts = ['warning-count', 'shown-instead-count', 'setup-change-count', 'jinx-count'];
	let sum = 0;
	for (const id of parts) sum += Number(await check.getByTestId(id).textContent());
	await expect(check.getByTestId('verification-count')).toHaveText(String(sum));
	await page.locator('.main[data-character-id="drunk"]').tap();
	await expect(row('drunk').getByTestId('not-in-bag')).toHaveCount(0);
});

test('Hold to see character, a Bag draw setting, shows the token only while held', async ({
	page
}) => {
	await selectionFor(page, 5);
	await select(page, 'Washerwoman', 'Empath', 'Monk', 'Poisoner', 'Imp');
	await page.getByRole('button', { name: 'Build bag' }).tap();
	await page.getByRole('button', { name: 'Bag draw' }).tap();
	await page.getByTestId('bag-settings').getByText('Hold to see character', { exact: true }).tap();
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: /^Tile 1/ }).tap();
	const reveal = page.getByRole('dialog', { name: /^Tile/ });
	const hold = reveal.getByTestId('reveal-hold');
	await expect(reveal.getByTestId('reveal-name')).toBeEmpty();
	await expect(reveal.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await hold.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
	await expect(reveal.getByTestId('reveal-name')).not.toBeEmpty();
	await hold.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
	await expect(reveal.getByTestId('reveal-name')).toBeEmpty();
	await expect(reveal.getByRole('button', { name: 'Confirm' })).toBeEnabled();
});

test('selecting a character moves nothing, and its lock picks it when not yet chosen', async ({
	page
}) => {
	// Trevor (2026-10-20): selecting moved the ability text down; the lock did nothing until chosen.
	await selectionFor(page, 8);
	const main = (id: string) => page.locator(`.main[data-character-id="${id}"]`);
	const row = (id: string) => page.locator('.row', { has: main(id) });
	for (const id of ['washerwoman', 'drunk', 'imp']) {
		// Measured within the row: the page above may grow as the selection changes.
		const place = () =>
			row(id).evaluate((r) => {
				const a = r.querySelector('.ability')!.getBoundingClientRect();
				const box = r.getBoundingClientRect();
				return { top: a.top - box.top, height: a.height, width: a.width, row: box.height };
			});
		const before = await place();
		await main(id).tap();
		await expect(main(id)).toHaveAttribute('aria-pressed', 'true');
		expect(await place()).toEqual(before);
	}
	const lock = row('baron').getByTestId('lock-character');
	await expect(main('baron')).toHaveAttribute('aria-pressed', 'false');
	await lock.tap();
	await expect(main('baron')).toHaveAttribute('aria-pressed', 'true');
	await expect(lock).toHaveAttribute('aria-pressed', 'true');
});
