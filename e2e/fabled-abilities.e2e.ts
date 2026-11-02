import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * Fabled whose ability players use by day (M15d): any living player may use the Doomsayer once
 * per game while 4 or more players live, and the Storyteller picks a living player of their
 * alignment, who dies by it (https://wiki.bloodontheclocktower.com/Doomsayer).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const sheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function choose(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await sheet(page).getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
}

async function addFabled(page: Page, name: string) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Fabled or Loric', exact: true })
		.tap();
	const adding = page.getByRole('dialog', { name: 'Add Fabled or Loric' });
	await adding.getByRole('button', { name, exact: true }).tap();
	await expect(adding).toBeHidden();
}

const boardSeat = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

test('any living player uses the Doomsayer once, and their ally dies by it', async ({ page }) => {
	// Two characters and a Fabled to place first.
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Clockmaker');
	await choose(page, 2, 'Dreamer');
	await addFabled(page, 'Doomsayer');
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^(Setup|Day( \d+)?)$/ });
	await expect(day).toBeVisible();

	const use = day.locator('li[data-character="doomsayer"]').getByTestId('day-use-anyone');
	await use.tap();
	// Who uses it: any living player.
	const user = page.getByRole('dialog', { name: /^Who uses Doomsayer\s?\?$/ });
	await user.getByRole('button', { name: /Seat 1/ }).tap();
	// Who dies: the Storyteller picks, from every seat, the user's own included.
	const victim = page.getByRole('dialog', {
		name: /^Who dies by Doomsayer \(\s?Seat 1\s?\)\s?\?$/
	});
	await expect(victim.getByRole('button', { name: /Seat 1/ })).toBeVisible();
	await victim.getByRole('button', { name: /Seat 2/ }).tap();
	const confirm = page.getByRole('alertdialog', { name: /^Mark Doomsayer/ });
	await expect(confirm.getByTestId('day-use-on')).toHaveText('Seat 2');
	await expect(
		confirm.getByRole('checkbox', { name: 'Seat 2 dies', includeHidden: true })
	).toBeChecked();
	await confirm.screenshot({ path: `test-results/doomsayer-${test.info().project.name}.png` });
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(confirm).toBeHidden();

	// Seat 1 has used it: offered again, but faded (warn, never lock).
	await use.tap();
	await expect(user.getByRole('button', { name: /Seat 1/ })).toHaveAttribute('data-misfit', 'true');
	await expect(user.getByRole('button', { name: /Seat 2/ })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(user).toBeHidden();
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(boardSeat(page, 'Seat 2')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 1')).not.toHaveAccessibleName(/dead/);
});
