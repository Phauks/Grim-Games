import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { toBoard } from './new-game.ts';
import { openPlayers } from './players.ts';

// Leaving a game in progress shows the game as Join game lists it (Trevor, 2026-11-06,
// mockup D), and Home keeps the last game at its top so it is one tap away again. The menu
// doesn't (Trevor, 2026-11-06: "there is already enough ways to access that").

async function openMenu(page: Page) {
	await page
		.getByRole('button', { name: /^(Open menu|Menu)$/ })
		.first()
		.tap();
	const drawer = page.getByRole('dialog', { name: APP_NAME });
	// Wide screens show the sidebar instead of the drawer.
	return (await drawer.isVisible()) ? drawer : page.getByRole('navigation', { name: 'Menu' });
}

/** Home's last game row. */
const homeLast = (page: Page) => page.getByRole('main').getByTestId('last-game');

test('a Storyteller leaving the board sees the game, then finds it on Home', async ({ page }) => {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const board = new URL(page.url()).pathname.replace(/\/setup$/, '');
	await page.goto(board);

	const menu = await openMenu(page);
	await expect(menu.getByTestId('last-game')).toHaveCount(0);
	await menu.getByRole('link', { name: 'Search' }).tap();

	const leave = page.getByRole('alertdialog', { name: 'Leave the game?' });
	const card = leave.getByTestId('leave-game-card');
	await expect(card).toContainText('Trouble Brewing');
	await expect(card).toContainText(/seats/);
	await expect(card).toContainText('Opens again from Join game');
	// Cancel is the only way to stay: no ✕ beside it.
	await expect(leave.getByRole('button', { name: 'Close' })).toHaveCount(0);
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).not.toHaveURL(new RegExp(board));

	await page.goto('/');
	await homeLast(page).tap();
	await expect(page).toHaveURL(new RegExp(`${board}$`));
});

test('leaving a players-only town says the town stays, and Home opens it again', async ({
	page
}) => {
	await page.goto('/new');
	await page.getByRole('combobox', { name: 'Host' }).tap();
	await page.getByRole('option', { name: /^Local Grim/ }).tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByTestId('grim-seat')).toHaveCount(7);

	await (await openMenu(page)).getByRole('link', { name: 'Library', exact: true }).tap();
	const leave = page.getByRole('alertdialog', { name: 'Leave the game?' });
	const card = leave.getByTestId('leave-game-card');
	await expect(card).toContainText('Trouble Brewing');
	await expect(card).toContainText('7 seats · None dead');
	await expect(card).toContainText('Your town stays on this phone');
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(/\/library$/);

	await page.goto('/');
	const last = homeLast(page);
	await expect(last).toHaveAccessibleName('Last game: Trouble Brewing');
	await last.tap();
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByRole('tab', { name: 'Grim' })).toHaveAttribute('aria-selected', 'true');
});

async function newGame(page: Page) {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/setup$/);
	await page.goto('/');
}

// Trevor, 2026-11-06: "menu ... for recent game, so that it can be closed, removed".
test("Home's last game hides from its ⋯, and the game stays in Join game", async ({ page }) => {
	await newGame(page);
	const main = page.getByRole('main');
	await expect(homeLast(page)).toBeVisible();
	await main.getByRole('button', { name: 'Last game options' }).tap();
	await page.getByRole('menuitem', { name: 'Hide' }).tap();
	await expect(homeLast(page)).toHaveCount(0);

	await page.goto('/join');
	await expect(page.getByRole('link', { name: /Trouble Brewing/ })).toBeVisible();
	await page.goto('/');
	await expect(homeLast(page)).toHaveCount(0);
});

test("Home's last game deletes the game from its ⋯ after asking", async ({ page }) => {
	await newGame(page);
	const last = homeLast(page);
	await page.getByRole('main').getByRole('button', { name: 'Last game options' }).tap();
	await page.getByRole('menuitem', { name: 'Delete game' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Delete this game?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(last).toHaveCount(0);

	await page.goto('/join');
	await expect(page.getByRole('link', { name: /Trouble Brewing/ })).toHaveCount(0);
});

// Trevor, 2026-11-16: "a way to leave the game if they don't want to be in it. That way they
// just don't remain as a spectator"; "Leave game for spectators or players".
test('a phone leaves the room from Leave the game, and the Storyteller no longer lists it', async ({
	page,
	browser
}, testInfo) => {
	test.setTimeout(90_000);
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.addInitScript(() =>
		localStorage.setItem('grim-games-room-name', JSON.stringify('Alex'))
	);
	await phone.goto(`/join/${code}`);
	await page.goto(board);
	const players = await openPlayers(page);
	const spectators = players.getByTestId('room-spectators');
	await expect(spectators.getByTestId('room-player')).toHaveText([/Alex/]);

	// Going elsewhere keeps the phone in the room unless it says otherwise.
	await (await openMenu(phone)).getByRole('link', { name: 'Library', exact: true }).tap();
	const leave = phone.getByRole('alertdialog', { name: 'Leave the game?' });
	const card = leave.getByTestId('leave-game-card');
	await expect(card).toContainText('You stay in the room');
	const out = leave.getByRole('checkbox', { name: 'Leave the room', includeHidden: true });
	await expect(out).not.toBeChecked();
	await leave.getByText('Leave the room', { exact: true }).tap();
	await expect(out).toBeChecked();
	await expect(card).toContainText('You leave the room');
	await leave.getByRole('button', { name: 'Confirm' }).tap();
	await expect(phone).toHaveURL(/\/library$/);

	// Gone from the room, not left behind as a spectator, and not listed as removed.
	await expect(spectators.getByTestId('room-player')).toHaveCount(0);
	await expect(players.getByText('Alex')).toHaveCount(0);
	// The phone no longer offers the room on Home.
	await phone.goto('/');
	await expect(homeLast(phone)).toHaveCount(0);

	// Back with the code, then out again from Home's last game, away from the game's screen.
	await phone.goto(`/join/${code}`);
	await expect(spectators.getByTestId('room-player')).toHaveText([/Alex/]);
	await phone.goto('/');
	await phone.getByRole('main').getByRole('button', { name: 'Last game options' }).tap();
	await phone.getByRole('menuitem', { name: 'Leave room' }).tap();
	await phone
		.getByRole('alertdialog', { name: 'Leave the room?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(homeLast(phone)).toHaveCount(0);
	await expect(spectators.getByTestId('room-player')).toHaveCount(0);
});
