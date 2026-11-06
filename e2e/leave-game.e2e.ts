import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';

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
	await page.getByRole('option', { name: 'Local Grim', exact: true }).tap();
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
