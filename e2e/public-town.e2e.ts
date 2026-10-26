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

	// Join game opens it with the room's code, beside Join as player.
	const tabletContext = await browser.newContext({ ...testInfo.project.use });
	const tablet = await tabletContext.newPage();
	await tablet.goto('/join');
	const open = tablet.getByRole('button', { name: 'Public Town' });
	await expect(open).toBeDisabled();
	const field = tablet.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
	await expect(tablet.getByTestId('room-preview')).toContainText('Trouble Brewing');
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
	// The app's menu stays top left, as on every screen.
	await expect(tablet.getByRole('button', { name: 'Menu' })).toBeVisible();

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
