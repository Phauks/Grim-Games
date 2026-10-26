import { expect, test, type Page } from '@playwright/test';
import { listedAdmin, signIn } from './admin.ts';
import { toBoard } from './new-game.ts';
import { theMenu } from './shell.ts';

// Live games (plan J31, Trevor 2026-10-26): "admin should have new area that allows admin to view
// all active games ... the admin would be invisible to the storyteller and players. they cannot
// influence the game".

async function openRoom(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	return (await page.getByTestId('share-code').textContent())!;
}

test('an admin lists the open rooms and watches one, unseen and read-only', async ({
	page,
	browser
}, testInfo) => {
	const shown = await openRoom(page);
	const code = shown.replace(/\s/g, '');

	const adminContext = await browser.newContext({ ...testInfo.project.use });
	const admin = await adminContext.newPage();
	// Signed out, the list and the room are not there at all.
	expect((await admin.request.get('/api/admin/games')).status()).toBe(404);
	await admin.goto('/live-games');
	await expect(admin.getByText('Only admin accounts see live games.')).toBeVisible();

	await signIn(admin, listedAdmin(testInfo, 3));
	// Only admins have it, in the menu's Admin group.
	await (await theMenu(admin)).getByRole('link', { name: 'Live games' }).tap();
	await expect(admin).toHaveURL(/\/live-games$/);
	const row = admin.getByTestId('live-games').locator('tr', { hasText: shown });
	await expect(row).toContainText('Trouble Brewing');
	await expect(row).toContainText('Table only');
	await row.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(admin).toHaveURL(new RegExp(`/live-games/${code}$`));

	// The town as the table sees it, with nothing to tap.
	const grim = admin.getByTestId('player-grim');
	const seats = grim.getByTestId('grim-seat');
	await expect(seats).toHaveCount(8);
	await expect(grim.getByRole('button')).toHaveCount(0);

	// Unseen: the Storyteller's room counts no player and no one watching.
	await expect(page.getByTestId('status-players')).toHaveText('0 players');
	await expect(page.getByTestId('status-watching')).toHaveText('0 watching');

	// Live: what the Storyteller does shows at once.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
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
	await adminContext.close();
});
