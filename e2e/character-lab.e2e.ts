import { expect, test, type Page } from '@playwright/test';
import { pickNumber } from './number-select.ts';

// The Character Lab (plan M37, Trevor 2026-11-03: "lock philosopher and tea lady on a script
// and then just keep cycling through or manually changing like the different opposing
// characters"; "You should be able to inspect all data used for a character"). The Philosopher's
// one jinx is with the Bounty Hunter (static/data/jinxes.json).

async function lockCharacter(page: Page, name: string) {
	await page.getByRole('button', { name: 'Add', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Lock a character' });
	await dialog.getByRole('button', { name, exact: true }).first().tap();
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('lab-locked')).toContainText(name);
}

/** The lab game's seats: in the frame beside the controls, or the page Load game opened. */
async function labSeats(page: Page) {
	const frame = page.getByTestId('lab-frame');
	if (await frame.isVisible()) return frame.locator('iframe').contentFrame().getByTestId('seat');
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	return page.getByTestId('seat');
}

test('locks characters, lists their jinxes and loads a game seating them', async ({ page }) => {
	await page.goto('/character-lab');
	await expect(page.getByRole('heading', { name: 'Character Lab', level: 1 })).toBeVisible();
	await pickNumber(page, 'Players', '12 players');
	await lockCharacter(page, 'Philosopher');
	await lockCharacter(page, 'Tea Lady');

	// Jinxes is the first source: the Bounty Hunter, the only one, with its jinx text.
	const pairings = page.getByTestId('lab-pairing');
	await expect(pairings).toHaveCount(1);
	await expect(pairings.first()).toContainText('Bounty Hunter');
	await expect(page.getByTestId('lab-position')).toHaveText('1 of 1');
	await expect(page.getByTestId('lab-jinxes').getByTestId('jinx-note')).toHaveCount(1);

	// The inspector is the Character reference's All data, for any character listed.
	await page.getByRole('button', { name: 'All data for Bounty Hunter' }).tap();
	const data = page.getByRole('dialog', { name: /all data/ });
	await expect(data).toContainText('static/data/roles.json');
	await expect(data).toContainText('src/lib/core/data/rules/bountyhunter.json');
	await page.keyboard.press('Escape');
	await expect(data).toBeHidden();

	// A result for the pairing, kept for the results file.
	await page.getByRole('button', { name: 'Works', exact: true }).tap();
	await expect(page.getByText('1 work, 0 with a problem')).toBeVisible();

	await page.getByRole('button', { name: 'Load game' }).tap();
	const seats = await labSeats(page);
	await expect(seats).toHaveCount(12);
	await expect(seats.nth(0)).toHaveAttribute('aria-label', /Philosopher/);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /Tea Lady/);
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /Bounty Hunter/);

	// The lab's game is not one being played: Continue game doesn't list it.
	await page.goto('/join');
	await expect(page.getByRole('heading', { name: 'Continue game', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Character Lab/ })).toHaveCount(0);

	// Back in the lab, every choice and the result are as they were.
	await page.goto('/character-lab');
	await expect(page.getByTestId('lab-locked')).toContainText('Tea Lady');
	await page.getByRole('button', { name: 'Results' }).tap();
	await expect(page.getByTestId('lab-results')).toContainText('Bounty Hunter');
});

test('cycles through hand-picked opponents, one fresh game each', async ({ page }) => {
	await page.goto('/character-lab');
	await lockCharacter(page, 'Philosopher');
	await page.getByRole('combobox', { name: 'Opponents' }).tap();
	await page.getByRole('option', { name: /^Hand-picked/ }).tap();
	await page.getByRole('button', { name: 'Choose opponents' }).tap();
	const picker = page.getByRole('dialog', { name: 'Opponents' });
	await picker.getByRole('button', { name: 'Chef', exact: true }).first().tap();
	await picker.getByRole('button', { name: 'Empath', exact: true }).first().tap();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('lab-pairing')).toHaveCount(2);

	await page.getByRole('button', { name: 'Load game' }).tap();
	let seats = await labSeats(page);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /Chef/);
	if (!(await page.getByTestId('lab-frame').isVisible())) await page.goto('/character-lab');
	await page.getByRole('button', { name: 'Next', exact: true }).tap();
	seats = await labSeats(page);
	await expect(seats.nth(1)).toHaveAttribute('aria-label', /Empath/);
});

test('steps the character under test without the picker', async ({ page }) => {
	await page.goto('/character-lab');
	await lockCharacter(page, 'Philosopher');
	const testing = page.getByTestId('lab-testing');
	await expect(testing).toContainText('Philosopher');
	// With Jinxes chosen, the next character is the next one in roles.json with a jinx.
	await testing.getByRole('button', { name: 'Next character' }).tap();
	await expect(testing).not.toContainText('Philosopher');
	await expect(page.getByTestId('lab-pairing').first()).toBeVisible();
	if (!(await page.getByTestId('lab-frame').isVisible()))
		await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	else {
		await testing.getByRole('button', { name: 'Previous character' }).tap();
		await expect(testing).toContainText('Philosopher');
	}
});

// Load game sets the game up as after a real draw and starts it (Trevor, 2026-11-04: "load game
// and start game should be the same"; the Marionette "thinks they are a player"): the
// Marionette's seat holds a Townsfolk with the Is The Marionette reminder, and the first night
// is under way.
test('loads a started game, the Marionette thinking they are a Townsfolk', async ({ page }) => {
	await page.goto('/character-lab');
	await lockCharacter(page, 'Marionette');
	await page.getByRole('button', { name: 'Load game' }).tap();
	const seats = await labSeats(page);
	await expect(seats.nth(0)).toHaveAttribute('aria-label', /Marionette, believes they are the /);
	const frame = page.getByTestId('lab-frame');
	const board = (await frame.isVisible()) ? frame.locator('iframe').contentFrame() : page;
	await expect(board.getByRole('button', { name: 'End night', exact: true })).toBeVisible();
	await expect(board.getByRole('button', { name: 'Start game', exact: true })).toHaveCount(0);
});
