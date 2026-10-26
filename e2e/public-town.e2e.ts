import { expect, test, type Page } from '@playwright/test';
import { expectMatchingIconRow } from './icon-row.ts';
import { toBoard } from './new-game.ts';

// Public Town (Trevor, 2026-10-26): "an additional tablet could be used to display the player
// grim and that is it. Placed in the center of the table."

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	return new URL(page.url()).pathname;
}

test("a table's tablet shows the players' grim live, with nothing to tap and no member", async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	// Join game opens it with the room's code, from ⋯ beside Join as player (Trevor,
	// 2026-10-26: "more advanced").
	const tabletContext = await browser.newContext({ ...testInfo.project.use });
	// The table's tablet runs the installed app (display-mode: standalone).
	await tabletContext.addInitScript(() => {
		const real = window.matchMedia.bind(window);
		window.matchMedia = (query: string) =>
			query === '(display-mode: standalone)'
				? ({ ...real(query), matches: true, media: query } as MediaQueryList)
				: real(query);
	});
	const tablet = await tabletContext.newPage();
	await tablet.goto('/join');
	const more = tablet.getByRole('button', { name: 'More ways to join' });
	const open = tablet.getByRole('menuitem', { name: 'Public Town' });
	await more.tap();
	await expect(open).toBeDisabled();
	await tablet.keyboard.press('Escape');
	await expect(open).toHaveCount(0);
	const field = tablet.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
	await expect(tablet.getByTestId('room-preview')).toContainText('Trouble Brewing');
	await more.tap();
	await open.tap();
	await expect(tablet).toHaveURL(new RegExp(`/town/${code}$`));

	const town = tablet.getByTestId('player-grim');
	const seats = town.getByTestId('grim-seat');
	await expect(seats).toHaveCount(8);
	await expect(seats.first()).toHaveAttribute('aria-label', 'Seat 1: Seat 1');
	// Only drawn: no seat is a button, and a tap opens nothing.
	await expect(town.getByRole('button')).toHaveCount(0);
	await seats.nth(1).tap();
	await expect(tablet.getByRole('dialog')).toHaveCount(0);
	// The top of the app is the player screen's (Trevor, 2026-10-26: "same as storyteller/player
	// shared grim"): the script's name and byline, Print and Share, and the app's menu.
	await expect(tablet.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await expect(tablet.getByTestId('script-byline')).toContainText('The Pandemonium Institute');
	await expect(tablet.getByRole('button', { name: 'Print script' })).toBeVisible();
	await expect(tablet.getByRole('button', { name: 'Share script' })).toBeVisible();
	await expect(tablet.getByRole('button', { name: 'Menu' }).first()).toBeVisible();
	// The title line's buttons all look alike (Trevor, 2026-10-26).
	await expectMatchingIconRow(tablet.getByRole('banner').or(tablet.locator('header')).first(), [
		'Sheet background',
		'Print script',
		'Share script'
	]);
	// Full screen sits in the town's own top right corner, and the town alone fills the screen
	// (Trevor, 2026-10-26: "supposed to be in the town square, and makes it so the townsquare
	// takes up the whole screen"). This tablet runs as the installed app, which hides the
	// board's full screen but not the town's (Trevor, on his phone: "don't see full screen
	// button to enlarge town grim").
	const fullScreen = tablet
		.getByTestId('public-town')
		.getByRole('button', { name: 'Full screen', exact: true });
	const box = (await town.boundingBox())!;
	const corner = (await fullScreen.boundingBox())!;
	expect(corner.x + corner.width).toBeGreaterThan(box.x + box.width * 0.85);
	expect(corner.y).toBeLessThan(box.y + box.height * 0.15);
	// Only public things show, so no eye, cover or count over the town (Trevor, 2026-10-26: "no
	// need for a eyeball or hide grim view"; the count is the corner's, when it is on).
	const stage = tablet.getByTestId('public-town');
	await expect(stage.getByTestId('hide-guesses')).toHaveCount(0);
	await expect(stage.getByTestId('grim-counts')).toHaveCount(0);
	expect((await stage.boundingBox())!.y).toBeCloseTo(box.y, 0);
	// A settings cog beside it, kept in place and off until there are settings (Trevor,
	// 2026-10-26: "pre-emptively place a setting cog next to full screen").
	const cog = stage.getByRole('button', { name: 'Public Town settings' });
	await expect(cog).toBeDisabled();
	const gear = (await cog.boundingBox())!;
	expect(gear.x + gear.width).toBeLessThanOrEqual(corner.x + 1);
	expect(Math.abs(gear.y - corner.y)).toBeLessThan(2);
	await fullScreen.tap();
	// The request settles after the tap, so wait for it.
	await expect
		.poll(() => tablet.evaluate(() => document.fullscreenElement?.getAttribute('data-testid')))
		.toBe('public-town');
	await expect(fullScreen).toHaveAttribute('aria-pressed', 'true');
	const filled = (await town.boundingBox())!;
	const screen = tablet.viewportSize()!;
	expect(Math.round(filled.width)).toBe(screen.width);
	expect(Math.round(filled.height)).toBe(screen.height);
	// The grim starts at the top of the screen: nothing above it takes room.
	expect(Math.round(filled.y)).toBe(0);
	await fullScreen.tap();
	await expect.poll(() => tablet.evaluate(() => !!document.fullscreenElement)).toBe(false);
	await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');

	// The display is not a player: the Storyteller's room counts no one.
	await expect(page.getByTestId('status-players')).toHaveText('0 players');

	// What the Storyteller does in front of the town shows on it.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	// The board's corner, line for line, with the code so anyone at the table can join.
	await expect(town.getByTestId('board-room-code')).toContainText(code.slice(3));
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await page
		.locator('[data-scope="drawer"][data-part="content"]')
		.getByRole('button', { name: 'Status: Alive' })
		.tap();
	await page
		.getByRole('dialog', { name: /^Status of/ })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await expect(seats.first()).toHaveAttribute(
		'aria-label',
		'Seat 1: Seat 1, dead, ghost vote not used'
	);

	// Your games opens it the way it was last opened (Trevor, 2026-10-26: "shouldn't it reopen
	// to that mode").
	await tablet.goto('/join');
	const recent = tablet.getByTestId('recent-rooms').getByRole('button');
	await expect(recent).toHaveCount(1);
	await expect(recent).toContainText('Public Town');
	await recent.tap();
	await expect(tablet).toHaveURL(new RegExp(`/town/${code}$`));
	await expect(seats).toHaveCount(8);
	await tabletContext.close();
});

test('Public Town with a wrong or closed code says so', async ({ page }) => {
	await page.goto('/town/12345');
	await expect(page.getByRole('alert')).toHaveText(
		'That is not a room code. Codes are six digits.'
	);
	await page.goto('/town/000001');
	await expect(page.getByRole('alert')).toHaveText('This room is closed, or the code is wrong.');
	await expect(page.getByTestId('player-grim')).toHaveCount(0);
});

test("Public Town shows the Storyteller's day timer during the day, as phones do", async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-10-26: "During day, public Town can show the timer as well".
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	const tabletContext = await browser.newContext({ ...testInfo.project.use });
	const tablet = await tabletContext.newPage();
	await tablet.goto(`/town/${code}`);
	await expect(tablet.getByTestId('player-grim').getByTestId('grim-seat')).toHaveCount(8);
	const shown = tablet.getByTestId('players-timer');
	const title = tablet.getByRole('heading', { name: 'Trouble Brewing', level: 1 });
	const before = (await title.boundingBox())!;

	// One character, so the bank offers Start game; the first night shows no timer.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const seat = page.locator('[data-scope="drawer"][data-part="content"]');
	await seat.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seat).toBeHidden();
	const bank = page.getByRole('list', { name: 'Reminder bank' }).locator('..');
	await bank.getByRole('button', { name: 'Start game', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(strip).toBeVisible();
	await expect(shown).toHaveCount(0);
	// The status line says where the game is up to (Trevor, 2026-10-26).
	await expect(tablet.getByTestId('players-status').first()).toHaveText('Night 1');

	// The day: the sun, in the title line, which keeps its place.
	await bank.getByRole('button', { name: 'End night', exact: true }).tap();
	await page
		.getByRole('alertdialog', { name: 'End the night?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByRole('dialog', { name: 'Day 1' })).toBeVisible();
	await expect(shown).toHaveAttribute('data-look', 'sun');
	await expect(shown.getByRole('img')).toHaveAttribute(
		'aria-label',
		'Day timer: 100% of the day left'
	);
	const after = (await title.boundingBox())!;
	expect(Math.abs(after.y - before.y)).toBeLessThan(2);
	// In full screen the title line is gone, so it moves to the town's own corner.
	await tablet.getByRole('button', { name: 'Full screen', exact: true }).tap();
	await expect
		.poll(() => tablet.evaluate(() => document.fullscreenElement?.getAttribute('data-testid')))
		.toBe('public-town');
	await expect(tablet.getByTestId('public-town').getByTestId('players-timer')).toBeVisible();
	await tablet
		.getByTestId('public-town')
		.getByRole('button', { name: 'Full screen', exact: true })
		.tap();
	await expect.poll(() => tablet.evaluate(() => !!document.fullscreenElement)).toBe(false);
	await tabletContext.close();
});

test("every shared grim has the Storyteller's background, whatever the device's own theme", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-26): "Even if player changes settings for their theme, the background for
	// the shared grim should be the same. Although font settings may be different."
	const board = await startGame(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: 'Board' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('group', { name: 'Background', exact: true })
		.getByRole('button', { name: 'Green felt' })
		.tap();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByTestId('board-background')).toHaveAttribute('data-preset', 'felt');
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	// The tablet's own sheet background is parchment, which themes its whole screen.
	const tabletContext = await browser.newContext({ ...testInfo.project.use });
	await tabletContext.addInitScript(() =>
		localStorage.setItem(
			'grim-games:player-settings:v1',
			JSON.stringify({ sheetBackground: 'parchment' })
		)
	);
	const tablet = await tabletContext.newPage();
	await tablet.goto(`/town/${code}`);
	const town = tablet.getByTestId('player-grim');
	await expect(town.getByTestId('grim-seat')).toHaveCount(8);
	await expect(town.getByTestId('preview-background')).toHaveAttribute('data-preset', 'felt');
	await expect(town.getByTestId('preview-vignette')).toBeAttached();
	// The town keeps the board's colours, not the parchment around it.
	const colours = await town.evaluate((el) => ({
		town: getComputedStyle(el).getPropertyValue('--surface').trim(),
		page: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
	}));
	expect(colours.page).not.toBe(colours.town);
	expect(colours.town).toBe('#140b0b');

	// A change on the board reaches it.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Grimoire' }).getByRole('button', { name: 'Board' }).tap();
	await settings
		.getByRole('group', { name: 'Background', exact: true })
		.getByRole('button', { name: 'Night sky' })
		.tap();
	await expect(town.getByTestId('preview-background')).toHaveAttribute('data-preset', 'night');
	await tabletContext.close();
});
