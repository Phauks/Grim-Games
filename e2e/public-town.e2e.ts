import { expect, test, type Page } from '@playwright/test';
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
	// Full screen, last in the title line's top right corner (Trevor, 2026-10-26: "we will
	// definitely need a button to allow fullscreen in the top right corner").
	const fullScreen = tablet.getByRole('button', { name: 'Full screen', exact: true });
	const share = (await tablet.getByRole('button', { name: 'Share script' }).boundingBox())!;
	const corner = (await fullScreen.boundingBox())!;
	expect(corner.x).toBeGreaterThan(share.x);
	expect(Math.abs(corner.y - share.y)).toBeLessThan(2);
	// Drawn like Print and Share beside it (Trevor, 2026-10-26: "it looks different from the
	// others in the line").
	await expect(fullScreen).not.toHaveAttribute('data-outlined');
	// It fills the screen with the town alone, not the app (Trevor, 2026-10-26: "not the app
	// itself, but that part of it"), whose own corner then holds the way back.
	await fullScreen.tap();
	// The request settles after the tap, so wait for it.
	await expect
		.poll(() => tablet.evaluate(() => document.fullscreenElement?.getAttribute('data-testid')))
		.toBe('public-town');
	const exit = tablet
		.getByTestId('public-town')
		.getByRole('button', { name: 'Full screen', exact: true });
	await expect(exit).toHaveAttribute('aria-pressed', 'true');
	await expect(town).toBeVisible();
	await exit.tap();
	await expect.poll(() => tablet.evaluate(() => !!document.fullscreenElement)).toBe(false);
	await expect(exit).toHaveCount(0);
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
