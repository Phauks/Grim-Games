import { expect, test } from '@playwright/test';
import { pickNumber } from './number-select.ts';

// A players-only game (plan M55, Trevor 2026-11-05): no Storyteller in the app, so the
// player keeps their own town on /play's Grim tab, on this phone only.

test('a player sets up and marks their own town with no room', async ({ page }) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	const grim = page.getByRole('tabpanel');

	// No seats yet: the seat count, None, where the town goes.
	await expect(grim.getByRole('combobox', { name: 'Seats', exact: true })).toHaveText(/None/);
	await pickNumber(grim, 'Seats', 7);
	const seats = page.getByTestId('grim-seat');
	await expect(seats).toHaveCount(7);

	// A seat's sheet: name it, mark it dead, then its ghost vote spent.
	await seats.nth(2).tap();
	const sheet = page.getByRole('dialog', { name: /Seat 3/ });
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Jo Ann');
	await expect(sheet.getByRole('heading', { name: 'Seat 3 · Jo Ann' })).toBeVisible();
	const vote = sheet.getByRole('checkbox', { name: 'Ghost vote used' });
	await expect(vote).toBeDisabled();
	await sheet.getByText('Dead', { exact: true }).tap();
	await expect(vote).toBeEnabled();
	await sheet.getByText('Ghost vote used', { exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /Jo Ann, dead, ghost vote used/);

	// Kept on the phone: a reload brings the same town back.
	await page.reload();
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await expect(seats).toHaveCount(7);
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /Jo Ann, dead, ghost vote used/);

	// Fewer seats drop the last ones.
	await pickNumber(page.getByTestId('grim-tools'), 'Seats', 5);
	await expect(seats).toHaveCount(5);
});

test('New game starts a players-only game, and Join game lists it apart', async ({ page }) => {
	// Trevor, 2026-11-05: "a toggle in new game would be enough", and players-only games "show
	// up differently in the resume game area".
	await page.goto('/new');
	await page.getByText('Players only', { exact: true }).tap();
	// No room vote with no Storyteller: shown, but off.
	await expect(page.getByRole('button', { name: 'Room vote' })).toBeDisabled();
	await page.getByRole('button', { name: 'Create game' }).tap();

	// Straight to the player screen's Grim tab, where the town is set up.
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByRole('tab', { name: 'Grim' })).toHaveAttribute('aria-selected', 'true');
	await pickNumber(page.getByRole('tabpanel'), 'Seats', 6);
	await page.getByTestId('grim-seat').nth(0).tap();
	const sheet = page.getByRole('dialog', { name: /Seat 1/ });
	await sheet.getByText('Dead', { exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// Join game: its own section, between the rooms and the Storyteller's games.
	await page.goto('/join');
	await expect(page.getByRole('heading', { level: 2 })).toHaveText([
		'As player',
		'Players only',
		'As Storyteller'
	]);
	const row = page.getByTestId('players-only-games').getByRole('button');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('Trouble Brewing');
	await expect(row).toContainText('6 seats · 1 dead');

	// A tap goes back to its town, on Grim.
	await row.tap();
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByRole('tab', { name: 'Grim' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('grim-seat')).toHaveCount(6);
});
