import { expect, test, type Page } from '@playwright/test';

/**
 * Game modes on New game (Trevor, 2026-10-17): choose a mode, inspect every part of it, and
 * restrict characters. Whale Buffet's rules: https://whalebuffet.com/.
 */
const modesPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Game modes' });

/** Game modes have their own tab on New game (Trevor, 2026-10-17). */
async function chooseMode(page: Page, name: string) {
	await page.getByRole('tab', { name: 'Game modes' }).tap();
	const modes = modesPanel(page).getByRole('radiogroup', { name: 'Game mode' });
	await modes.getByText(name, { exact: true }).tap();
	await expect(modes.getByRole('radio', { name, exact: true })).toBeChecked();
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

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
	await expect(dialog.locator('[data-part="towns"]')).toContainText('Standard');
	await expect(dialog.locator('pre')).toContainText('"id": "whale-buffet"');
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
	await expect(modesPanel(page).getByTestId('mode-about')).toContainText('draft');
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

test('Two games at once: one name per player for both games, warnings start at None', async ({
	page
}) => {
	// Trevor, 2026-10-17: players play two scripts at once; nobody is the Demon in both.
	await page.goto('/new');
	await chooseMode(page, 'Two games at once');
	const panel = modesPanel(page);
	await panel.getByRole('combobox', { name: 'Town 2 script' }).tap();
	await page.getByRole('option', { name: 'Bad Moon Rising', exact: true }).tap();
	for (let n = 8; n > 5; n--) await panel.getByRole('button', { name: 'Fewer players' }).tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/towns\/[\w-]+$/);
	await expect(page.getByTestId('town')).toHaveCount(2);
	await expect(page.getByTestId('town').first()).toContainText('Trouble Brewing');
	await expect(page.getByTestId('town').nth(1)).toContainText('Bad Moon Rising');
	await expect(page.getByTestId('town-warnings')).toContainText('None');

	const name = page.getByLabel('Seat 1', { exact: true });
	await name.fill('Ana');
	await name.press('Enter');
	// The name reaches both games: each board shows it.
	const hrefs = await page
		.getByRole('link', { name: /^Open town/ })
		.evaluateAll((links) =>
			links.map((a) => (a as HTMLAnchorElement).pathname.replace(/\/setup$/, ''))
		);
	expect(hrefs).toHaveLength(2);
	const towns = page.url();
	for (const href of hrefs) {
		await page.goto(href);
		await expect(page.getByText('Ana', { exact: true }).first()).toBeVisible();
	}
	// Each town's board leads back to the towns from its ⋯ menu.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: 'Towns' }).tap();
	// Leaving the board asks first, as the app's navigation does; the game stays saved.
	await page
		.getByRole('alertdialog', { name: 'Leave the game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(page).toHaveURL(towns);
	await expect(page.getByLabel('Seat 1', { exact: true })).toHaveValue('Ana');
	await noSidewaysScroll(page);
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
	await expect(page).toHaveURL(/\/towns\/[\w-]+$/);
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
	await dialog.getByTestId('mode-file').fill('{"format": 1, "id": "Bad Id"}');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog.getByRole('status')).toContainText('id: must be lower-case');
	await expect(dialog.getByRole('status')).toContainText('sources: must list at least one source');

	const mine = {
		format: 1,
		id: 'tiny-buffet',
		name: 'Tiny Buffet',
		sources: [{ title: 'Our group', url: 'https://example.com/tiny' }],
		parts: {
			pool: { kind: 'all-characters' },
			restricted: { banned: ['pithag'] },
			assignment: { kind: 'choose-own', when: 'first-night', reconsider: false }
		}
	};
	await dialog.getByTestId('mode-file').fill(JSON.stringify(mine));
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog).toHaveCount(0);
	const modes = panel.getByRole('radiogroup', { name: 'Game mode' });
	await expect(modes.getByRole('radio', { name: 'Tiny Buffet', exact: true })).toBeChecked();
	await expect(panel.getByRole('button', { name: /^Restricted characters/ })).toContainText('(1)');

	// It stays on this device.
	await page.reload();
	await chooseMode(page, 'Tiny Buffet');
	await panel.getByRole('button', { name: 'Delete Tiny Buffet' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(modes.getByRole('radio', { name: 'Tiny Buffet', exact: true })).toHaveCount(0);
	await noSidewaysScroll(page);
});

test('A Script of Infinite Possibilities rolls hidden characters from off the script into the selection', async ({
	page
}) => {
	// https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/
	await page.goto('/new');
	await chooseMode(page, 'A Script of Infinite Possibilities');
	const panel = modesPanel(page);
	await panel.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await panel.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/extras$/);
	await expect(page.getByRole('heading', { name: 'Hidden characters', level: 1 })).toBeVisible();
	const extras = page.getByTestId('extras').locator('li');
	await expect(extras).toHaveCount(2);
	await expect(extras.nth(0)).toContainText('Townsfolk');
	await expect(extras.nth(1)).toContainText('Minion');
	await expect(page.getByTestId('extras-range')).toHaveText(
		'Tell the table: 1 to 3 hidden characters'
	);
	// Rolling one again swaps it for another off-script character of the same type.
	const reroll = extras.nth(0).getByRole('button', { name: /^Roll again instead of / });
	const before = await reroll.getAttribute('aria-label');
	await reroll.tap();
	await expect(
		extras.nth(0).getByRole('button', { name: /^Roll again instead of / })
	).not.toHaveAttribute('aria-label', before!);
	await noSidewaysScroll(page);

	await page.getByRole('button', { name: 'Choose characters' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	// Off the script, so not in the list, but chosen for the bag.
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-minion')).toHaveText('1');
});
