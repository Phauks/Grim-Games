import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { pickScript, toBoard } from './new-game.ts';
import { putReminder } from './reminder-bank.ts';

/**
 * Breaking madness (L84, https://wiki.bloodontheclocktower.com/Madness): the day view's
 * madness row offers what the Storyteller may do to a mad player who breaks it. The Cerenovus's
 * mad player might be executed (https://wiki.bloodontheclocktower.com/Cerenovus); for the
 * Harpy, the 1st player, the 2nd or both might die (https://wiki.bloodontheclocktower.com/Harpy).
 * With the Big Wig, each nominee chooses a player, who might die
 * (https://wiki.bloodontheclocktower.com/Big_Wig).
 */

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Sects & Violets');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

const sheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function choose(page: Page, number: number, name: string, offScript = false) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await sheet(page).getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: `Character for Seat ${number}` });
	if (offScript) await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name, exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
}

const boardSeat = (page: Page, start: string) =>
	page.locator(`[data-testid="seat"][aria-label^="${start}"]`);

async function openDay(page: Page) {
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const day = page.getByRole('dialog', { name: /^Day( \d+)?$/ });
	await expect(day).toBeVisible();
	return day;
}

test("the Cerenovus's mad player who breaks madness is offered for execution", async ({ page }) => {
	// Several characters and reminders to place first.
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Cerenovus');
	await choose(page, 2, 'Clockmaker');
	await putReminder(page, 'Mad', 2);
	const day = await openDay(page);
	const row = day.locator('li[data-character="cerenovus"]');
	await row.getByTestId('broke-madness').tap();
	// The day's Execution asks, with the mad player chosen.
	const ask = page.getByRole('alertdialog', { name: 'End the day?' });
	await expect(ask.getByRole('combobox', { name: 'Execution' })).toContainText('Seat 2');
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await expect(boardSeat(page, 'Seat 2')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 1')).not.toHaveAccessibleName(/dead/);
});

test("the Harpy's mad player who breaks madness asks who of the two dies", async ({ page }) => {
	// Several characters and reminders to place first.
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Harpy', true);
	await choose(page, 2, 'Clockmaker');
	await choose(page, 3, 'Dreamer');
	await putReminder(page, 'Mad', 2);
	await putReminder(page, '2nd', 3);
	const day = await openDay(page);
	await day.locator('li[data-character="harpy"]').getByTestId('broke-madness').tap();
	const ask = page.getByRole('alertdialog', { name: 'Who dies for breaking madness?' });
	const deaths = ask.getByTestId('madness-deaths');
	await expect(deaths).toContainText(/Seat 2\s*Seat 3/);
	// Nobody is chosen to start with; the Storyteller may kill one or both.
	await expect(ask.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
	await deaths
		.getByRole('listitem')
		.filter({ hasText: 'Seat 3' })
		.locator('[data-part="control"]')
		.tap();
	await expect(ask.getByRole('checkbox', { name: 'Dies: Seat 3' })).toBeChecked();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(boardSeat(page, 'Seat 3')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 2')).not.toHaveAccessibleName(/dead/);
});

async function trackNominations(page: Page) {
	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller' })
		.tap();
	await settings.getByText('Track nominations', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
}

test('the Big Wig asks whom a nominee chose, who might die for breaking madness (M11)', async ({
	page
}) => {
	// Several characters to place first.
	test.slow();
	await startGame(page);
	await choose(page, 1, 'Clockmaker');
	await choose(page, 2, 'Dreamer');
	await choose(page, 3, 'Oracle');
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Fabled or Loric', exact: true })
		.tap();
	const adding = page.getByRole('dialog', { name: 'Add Fabled or Loric' });
	await adding.getByRole('button', { name: 'Big Wig', exact: true }).tap();
	await expect(adding).toBeHidden();
	await trackNominations(page);
	// Seat 1 nominates Seat 2, who chooses Seat 3 to speak for them.
	await page.getByTestId('seat').nth(0).getByTestId('nomination-marks').tap();
	const chooser = page.getByRole('dialog', { name: 'Who did Seat 1 nominate?' });
	await chooser.getByText('Seat 2', { exact: true }).tap();
	await expect(chooser).toBeHidden();
	const speaker = page.getByRole('dialog', { name: 'Big Wig: who did Seat 2 choose?' });
	await speaker.getByText('Seat 3', { exact: true }).tap();
	await expect(speaker).toBeHidden();
	const day = await openDay(page);
	const row = day.locator('li[data-character="bigwig"]').filter({ hasText: 'is mad' });
	await expect(row).toContainText(/Seat 3.*is mad.*Seat 2.*is good/);
	await row.getByTestId('broke-madness').tap();
	const ask = page.getByRole('alertdialog', { name: 'Who dies for breaking madness?' });
	const deaths = ask.getByTestId('madness-deaths');
	await expect(deaths).toContainText('Seat 3');
	await deaths
		.getByRole('listitem')
		.filter({ hasText: 'Seat 3' })
		.locator('[data-part="control"]')
		.tap();
	await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ask).toBeHidden();
	await day.getByRole('button', { name: 'Close' }).tap();
	await expect(boardSeat(page, 'Seat 3')).toHaveAccessibleName(/dead/);
	await expect(boardSeat(page, 'Seat 2')).not.toHaveAccessibleName(/dead/);
});
