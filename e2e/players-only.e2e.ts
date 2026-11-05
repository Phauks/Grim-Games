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
