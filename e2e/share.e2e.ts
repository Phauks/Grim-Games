import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Every Share opens the one share screen, with what fits where it is (Trevor, 2026-10-23: "make
// sure they are all the same ... the QR code, the join code, etc"). The board's toolbar Share
// is the Storyteller's room controls, tested in grimoire.e2e.ts.

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

async function openScript(page: Page) {
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Trouble Brewing', exact: true });
	await expect(sheet).toBeVisible();
	return sheet;
}

test("the board's Script sheet has the players' tabs, and its Share matches /play's", async ({
	page
}) => {
	await startGame(page);
	const sheet = await openScript(page);
	// The same screens a player has (Trevor, 2026-10-23: "grim, notes, etc").
	await expect(sheet.getByRole('tab')).toHaveText(['Script', 'Night', 'Grim', 'Notes']);
	await sheet.getByRole('tab', { name: 'Grim' }).tap();
	// The town as the phones see it: eight seats, no characters.
	await expect(sheet.getByTestId('grim-seat')).toHaveCount(8);
	await sheet.getByRole('tab', { name: 'Notes' }).tap();
	await expect(sheet.getByRole('tabpanel', { name: 'Notes' })).toBeVisible();

	// Out of a room, Share is the script's link, as on /play.
	await sheet.getByRole('button', { name: 'Share script' }).tap();
	const share = page.getByRole('dialog', { name: 'Share Trouble Brewing' });
	await expect(share.getByTestId('share-url')).toHaveValue(/\/play#e=tb$/);
	await expect(share.getByTestId('share-code')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// In a room, it hands on the room: its QR code, join code and link.
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	const room = page.getByRole('dialog', { name: 'Share' });
	await expect(room.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await room.getByTestId('share-code').textContent())!.replace(/\D/g, '');
	await page.keyboard.press('Escape');
	await expect(room).toBeHidden();
	await (await openScript(page)).getByRole('button', { name: 'Share script' }).tap();
	await expect(share.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	await expect(share.getByTestId('share-url')).toHaveValue(new RegExp(`/join/${code}$`));
	await expect(share.getByRole('img', { name: 'QR code to join the room' })).toBeVisible();
});

test("Game info's Share opens the share screen with the script's source", async ({ page }) => {
	await startGame(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	await page.getByTestId('share-source').tap();
	const share = page.getByRole('dialog', { name: 'Share Trouble Brewing' });
	await expect(share.getByTestId('share-url')).toHaveValue(
		'https://wiki.bloodontheclocktower.com/Trouble_Brewing'
	);
	await expect(share.getByRole('img', { name: 'QR code for the script’s source' })).toBeVisible();
});

test("the players' Grim is drawn as the board: its seats where the board has them, and its corner", async ({
	page
}) => {
	// Trevor (2026-10-23): the player's grim should look exactly like the Storyteller's board.
	await startGame(page);
	const seat = page.getByRole('button', { name: /^Seat 1:/ });
	const board = (await page.locator('.board').boundingBox())!;
	const from = (await seat.boundingBox())!;
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Arrange seats' })
		.tap();
	// Seat 1 goes to the middle, a third of the way down, clear of the centre's buttons.
	const to = { x: board.x + board.width / 2, y: board.y + board.height * 0.3 };
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, (from.y + to.y) / 2, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 4 });
	await page.mouse.up();
	await page.getByRole('toolbar', { name: 'Grimoire' }).getByRole('button', { name: 'Done' }).tap();

	const sheet = await openScript(page);
	await sheet.getByRole('tab', { name: 'Grim' }).tap();
	const town = sheet.getByTestId('player-grim');
	await expect(town.getByTestId('grim-seat')).toHaveCount(8);
	const box = (await town.boundingBox())!;
	const placed = (await town.getByTestId('grim-seat').first().boundingBox())!;
	expect(Math.abs(placed.x + placed.width / 2 - (box.x + box.width / 2))).toBeLessThan(
		box.width * 0.05
	);
	expect(placed.y + placed.height / 2 - box.y).toBeLessThan(box.height * 0.45);
	// The board's corner, with the script's name, and its vignette under the seats.
	await expect(town.getByTestId('script-title')).toContainText('Trouble Brewing');
	await expect(town.getByTestId('board-room-code')).toHaveCount(0);
	await expect(town.getByTestId('preview-vignette')).toBeAttached();
});

test("a seat's focus ring in the players' Grim is round, around its token", async ({ page }) => {
	// Trevor (2026-10-24): it was a square around the seat, as tokens were before.
	await startGame(page);
	const sheet = await openScript(page);
	await sheet.getByRole('tab', { name: 'Grim' }).tap();
	const seat = sheet.getByTestId('grim-seat').first();
	await seat.tap();
	await page.keyboard.press('Escape');
	await expect(seat).toBeFocused();
	expect(await seat.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
	const ring = await seat
		.locator('[data-token-face]')
		.first()
		.evaluate((el) => {
			const style = getComputedStyle(el);
			return { outline: style.outlineStyle, radius: style.borderRadius };
		});
	expect(ring).toEqual({ outline: 'solid', radius: '50%' });
});
