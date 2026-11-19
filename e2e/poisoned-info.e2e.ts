import { expect, test } from '@playwright/test';
import { choose, openStep, poison, startGame, toNightTwo } from './night-two.ts';

/**
 * A drunk or poisoned player may be given any information, true or false
 * (https://wiki.bloodontheclocktower.com/Poisoner), so their night step offers the false
 * answers too, beside the true one (Trevor, 2026-10-27). Who poisoned them is the step's
 * Status only, not repeated under Valid Information.
 */

test('a poisoned Oracle is offered every count, not only the true one', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Oracle', true);
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Chef');
	await choose(page, 5, 'Empath');
	await toNightTwo(page, 'Seat 4');
	await poison(page, 1);

	const step = await openStep(page, 'Oracle');
	const suggested = step.getByTestId('night-suggested');
	// The true count first, then every other count up to the dead players (one: the Chef).
	const rows = suggested.getByTestId('answer-options').getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toHaveAttribute('data-reason', 'true');
	await expect(rows.nth(0).locator('.option strong')).toHaveText('0');
	await expect(rows.nth(1)).toHaveAttribute('data-reason', 'unreliable');
	await expect(rows.nth(1).locator('.option strong')).toHaveText('1');
	// Why, as the Poisoner's token from the board, its words for a screen reader only.
	await expect(rows.nth(1).getByText('Not reliable')).toHaveClass(/visually-hidden/);
	await expect(rows.nth(1)).toContainText('Poisoned');
	// No "(not reliable)" or "poisoned" words: the player and cause are under Status.
	await expect(suggested).not.toContainText('poisoned');
	await expect(step.getByRole('heading', { name: 'Status', exact: true })).toBeVisible();
	await page.screenshot({ path: `test-results/poisoned-oracle-${test.info().project.name}.png` });
	await rows.nth(1).getByRole('button', { name: 'Show to player' }).tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toContainText('1');
});

test('a poisoned Undertaker may be shown any other character', async ({ page }) => {
	await startGame(page);
	await choose(page, 1, 'Undertaker');
	await choose(page, 2, 'Poisoner');
	await choose(page, 3, 'Imp');
	await choose(page, 4, 'Slayer');
	await toNightTwo(page, 'Seat 4');
	await poison(page, 1);

	const step = await openStep(page, 'Undertaker');
	const rows = step.getByTestId('answer-options').getByRole('listitem');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0).locator('[data-character-id="slayer"]').first()).toBeVisible();
	const other = rows.nth(1);
	await expect(other).toContainText('Any other');
	const show = other.getByRole('button', { name: 'Show to player' });
	// Nothing picked yet: the list is ringed, and Show to player opens it (Trevor, 2026-10-28).
	const shownAs = other.getByRole('combobox', { name: 'Shown as' });
	await expect(shownAs).toHaveAttribute('data-attention');
	await expect(async () => {
		await show.tap();
		await page.getByRole('option', { name: 'Washerwoman' }).tap({ timeout: 2000 });
	}).toPass();
	await expect(shownAs).not.toHaveAttribute('data-attention');
	await page.screenshot({
		path: `test-results/poisoned-undertaker-${test.info().project.name}.png`
	});
	await show.tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toContainText('Washerwoman');
});
