import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { pickScript, toBoard } from './new-game.ts';

// Track nominations (Settings > Storyteller): the marks on each seat and the "Who did X
// nominate?" chooser. Nominations follow https://wiki.bloodontheclocktower.com/Glossary
// ("Nomination"): one each way per player per day, and the dead may be nominated but may not
// nominate.

async function startGame(page: Page) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
}

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

const sheet = (page: Page) => page.locator('[data-scope="drawer"][data-part="content"]');

async function openSeat(page: Page, number: number) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	await expect(sheet(page).getByRole('button', { name: 'Edit player name' })).toBeVisible();
	return sheet(page);
}

async function closeSheet(page: Page) {
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toBeHidden();
}

/** Taps seat `number`'s nomination marks and picks `nominee` (a seat number). */
async function nominate(page: Page, number: number, nominee: number) {
	await page
		.getByTestId('seat')
		.nth(number - 1)
		.getByTestId('nomination-marks')
		.tap();
	const chooser = page.getByRole('dialog', { name: `Who did Seat ${number} nominate?` });
	await chooser.getByText(`Seat ${nominee}`, { exact: true }).tap();
	await expect(chooser).toBeHidden();
}

/** Seat `number`'s row in an open chooser. */
const row = (page: Page, dialog: string, number: number) =>
	page
		.getByRole('dialog', { name: dialog })
		.getByRole('listitem')
		.filter({ hasText: new RegExp(`^${number}`) });

test('the nomination marks sit over the top-left rim, clear of the left night number', async ({
	page
}) => {
	// Trevor (2026-10-24): "it should be in the top left of a token, otherwise it blocks night
	// order". The first-night number sits on the middle of the left rim.
	await startGame(page);
	await trackNominations(page);
	const seat = page.getByTestId('seat').first();
	const disc = await seat.locator('.disc').boundingBox();
	const marks = await seat.getByTestId('nomination-marks').boundingBox();
	expect(disc && marks).toBeTruthy();
	const middle = disc!.y + disc!.height / 2;
	expect(marks!.y + marks!.height).toBeLessThan(middle - disc!.height * 0.1);
	expect(marks!.x).toBeLessThan(disc!.x + disc!.width / 2);
});

test('the nomination chooser opens again after it is closed without a choice', async ({ page }) => {
	// Trevor (2026-10-24): "the nomination button, if i back out of it, cannot be reused until
	// after i refresh the page".
	await startGame(page);
	await trackNominations(page);
	const marks = page.getByTestId('seat').nth(1).getByTestId('nomination-marks');
	const chooser = page.getByRole('dialog', { name: 'Who did Seat 2 nominate?' });
	for (let i = 0; i < 2; i++) {
		await marks.tap();
		await expect(chooser).toBeVisible();
		await chooser.getByRole('button', { name: 'Close' }).first().tap();
		await expect(chooser).toBeHidden();
	}
	// The seat sheet's rows too.
	const seat = await openSeat(page, 2);
	for (let i = 0; i < 2; i++) {
		await seat.getByTestId('sheet-nominated-by').tap();
		const by = page.getByRole('dialog', { name: 'Who nominated Seat 2?' });
		await expect(by).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(by).toBeHidden();
	}
	await closeSheet(page);
	await nominate(page, 2, 5);
	await expect(
		page.getByTestId('seat').nth(1).getByTestId('nominator-mark').and(page.locator('[data-on]'))
	).toHaveCount(1);
});

test('the chooser marks who has nominated and been nominated today', async ({ page }) => {
	// Trevor (2026-10-24): "it should note which characters have already been nominated on this
	// nomination screen".
	await startGame(page);
	await trackNominations(page);
	await nominate(page, 1, 3);
	await page.getByTestId('seat').nth(1).getByTestId('nomination-marks').tap();
	const title = 'Who did Seat 2 nominate?';
	const lit = (number: number, mark: string) =>
		row(page, title, number).getByTestId(mark).and(page.locator('[data-on]'));
	await expect(lit(3, 'chooser-nominated-mark')).toHaveCount(1);
	await expect(lit(3, 'chooser-nominator-mark')).toHaveCount(0);
	await expect(lit(1, 'chooser-nominator-mark')).toHaveCount(1);
	await expect(lit(4, 'chooser-nominated-mark')).toHaveCount(0);
	await expect(row(page, title, 4).getByTestId('chooser-nominated-mark')).toHaveCount(1);
});

test('a dead player may be nominated but is not offered as a nominator', async ({ page }) => {
	// Trevor (2026-10-24): "a dead player can be nominated but not be the nominator".
	await startGame(page);
	await trackNominations(page);
	const seat = await openSeat(page, 4);
	await seat.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 4' })
		.getByRole('button', { name: 'The Demon' })
		.tap();
	await expect(seat.getByTestId('sheet-nominated')).toBeDisabled();
	await closeSheet(page);
	const dead = page.getByTestId('seat').nth(3);
	await expect(dead.getByTestId('nominator-mark')).toHaveCount(0);
	await expect(dead.getByTestId('nominated-mark')).toHaveCount(1);
	// Their marks ask who nominated them.
	await dead.getByTestId('nomination-marks').tap();
	const by = page.getByRole('dialog', { name: 'Who nominated Seat 4?' });
	await expect(by).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(by).toBeHidden();
	// Not offered as the nominator of anyone else.
	const other = await openSeat(page, 6);
	await other.getByTestId('sheet-nominated-by').tap();
	const chooser = page.getByRole('dialog', { name: 'Who nominated Seat 6?' });
	await expect(chooser.getByText('Seat 5', { exact: true })).toBeVisible();
	await expect(chooser.getByText('Seat 4', { exact: true })).toHaveCount(0);
	// But they may be nominated.
	await page.keyboard.press('Escape');
	await expect(chooser).toBeHidden();
	await closeSheet(page);
	await nominate(page, 1, 4);
	await expect(dead.getByTestId('nominated-mark').and(page.locator('[data-on]'))).toHaveCount(1);
});
