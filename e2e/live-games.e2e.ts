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
	await page.getByRole('button', { name: 'Create game' }).tap();
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
	await row.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(admin).toHaveURL(new RegExp(`/live-games/${code}$`));

	// The whole grimoire, view-only (Trevor, 2026-10-26: "whole grimoire"), with characters.
	const adminSeat = admin.getByRole('button', { name: /^Seat 1:/ });
	await expect(adminSeat).toBeVisible();
	await expect(admin.getByTestId('player-grim')).toHaveCount(0);

	// Unseen: the Storyteller's room counts no player and no one watching.
	await expect(page.getByTestId('status-players')).toHaveText('0 players');
	await expect(page.getByTestId('status-watching')).toHaveText('0 watching');

	// Live: what the Storyteller does shows at once.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	const seat = page.getByRole('button', { name: /^Seat 1:/ });
	await seat.tap();
	await page
		.locator('[data-scope="drawer"][data-part="content"]')
		.getByRole('button', { name: 'Status: Alive' })
		.tap();
	await page
		.getByRole('dialog', { name: /^Status of/ })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await page.keyboard.press('Escape');
	const label = await seat.getAttribute('aria-label');
	expect(label).toMatch(/dead/i);
	await expect(adminSeat).toHaveAttribute('aria-label', label!);
	// Nothing on the board says an admin is watching.
	await expect(page.getByText(/watching/i)).toHaveCount(0);

	// A Fabled stays where the board puts it (Trevor, 2026-10-27: "Admin view allows moving
	// fable and lorics"): its Location and Grouping are the Storyteller's to set.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Fabled or Loric', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Spirit of Ivory', exact: true })
		.tap();
	const fabled = admin
		.getByRole('list', { name: 'Fabled and Loric' })
		.getByRole('button', { name: 'Spirit of Ivory' });
	await fabled.tap();
	const entry = admin.getByRole('dialog', { name: 'Spirit of Ivory' });
	await expect(entry.getByRole('combobox', { name: 'Location', exact: true })).toBeDisabled();
	await expect(entry.getByRole('combobox', { name: 'Grouping', exact: true })).toBeDisabled();
	await admin.keyboard.press('Escape');

	// History, read-only (Trevor, 2026-10-27: "Admin should have access to history"); the
	// rest of ⋯ shows, disabled.
	await admin.getByRole('button', { name: 'More', exact: true }).tap();
	const adminMenu = admin.getByRole('dialog', { name: 'Grimoire' });
	await expect(adminMenu.getByRole('button', { name: 'Add Fabled or Loric' })).toBeDisabled();
	await expect(adminMenu.getByRole('button', { name: 'End game' })).toBeDisabled();
	await adminMenu.getByRole('button', { name: 'History', exact: true }).tap();
	const history = admin.getByRole('dialog', { name: 'History' });
	await expect(history.getByRole('listitem').filter({ hasText: 'Spirit of Ivory' })).toBeVisible();
	await expect(history.getByRole('button', { name: 'Restore' })).toHaveCount(0);
	await expect(history.getByRole('button', { name: 'Show' }).first()).toBeVisible();
	await adminContext.close();
});
