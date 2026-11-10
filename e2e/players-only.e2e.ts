import { expect, test, type Page } from '@playwright/test';
import { pickNumber } from './number-select.ts';
import { leaveNote, newNoteRow, noteSummaries, noteTitle } from './notes.ts';

/** The titles of the notes this phone keeps for Trouble Brewing (notebook-store). */
const storedNotes = (page: Page) => () =>
	page.evaluate(
		() =>
			new Promise<string[]>((resolve, reject) => {
				const open = indexedDB.open('grim-games-player', 1);
				open.onsuccess = () => {
					const get = open.result
						.transaction('notebooks')
						.objectStore('notebooks')
						.get('edition:tb');
					get.onsuccess = () => {
						open.result.close();
						const notes = (get.result?.notes ?? []) as { title: string }[];
						resolve(notes.map((n) => n.title));
					};
					get.onerror = () => reject(get.error);
				};
				open.onerror = () => reject(open.error);
			})
	);

// A players-only game (plan M55, Trevor 2026-11-05): no Storyteller in the app, so the
// player keeps their own town on /play's Grim tab, on this phone only.

test('a player sets up and marks their own town with no room', async ({ page }) => {
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Grim' }).tap();
	const grim = page.getByRole('tabpanel');

	// Seven seats to start, never None (Trevor, 2026-11-06: "Seats should start at 7").
	const seats = page.getByTestId('grim-seat');
	await expect(seats).toHaveCount(7);
	await expect(grim.getByRole('combobox', { name: 'Seats', exact: true })).toHaveText(/7/);

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

	// Notes lists the town's seats for notes on players, as in a room (Trevor, 2026-11-06).
	await page.getByRole('tab', { name: 'Notes' }).tap();
	const rows = page.locator('[data-seat-note]');
	await expect(rows).toHaveCount(7);
	await expect(rows.nth(2)).toContainText('Jo Ann');
	await page.getByRole('tab', { name: 'Grim' }).tap();

	// Kept on the phone: a reload brings the same town back.
	await page.reload();
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await expect(seats).toHaveCount(7);
	await expect(seats.nth(2)).toHaveAttribute('aria-label', /Jo Ann, dead, ghost vote used/);

	// Fewer seats drop the last ones.
	await pickNumber(page.getByTestId('grim-tools'), 'Seats', '5 seats');
	await expect(seats).toHaveCount(5);
});

test('New game starts a players-only game, and Join game lists it apart', async ({ page }) => {
	// Trevor, 2026-11-06: "There is no difference between setup for a storyteller or player on
	// the first screen. It just changes the options later", and players-only games "show up
	// differently in the resume game area" (2026-11-05).
	await page.goto('/new');
	const host = page.getByRole('combobox', { name: 'Host' });
	await expect(host).toHaveText(/Storyteller/);
	// A line under Host says when to use each (Trevor, 2026-11-06), and nothing moves with it.
	const hint = page.getByTestId('host-hint');
	await expect(hint).toHaveText(/You run the game on this device/);
	const modeTop = (await page.getByRole('combobox', { name: 'Game mode' }).boundingBox())!.y;
	await host.tap();
	await page.getByRole('option', { name: /^Local Grim/ }).tap();
	await expect(hint).toHaveText(/The Storyteller runs the game outside the app/);
	// Within a pixel: the line box rounds differently with other words in it.
	expect((await page.getByRole('combobox', { name: 'Game mode' }).boundingBox())!.y).toBeCloseTo(
		modeTop,
		0
	);
	// The same screen: Game mode, Room vote and the script preview all stay.
	await expect(page.getByRole('combobox', { name: 'Game mode' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Room vote' })).toBeVisible();
	await expect(page.getByTestId('script-preview')).toBeVisible();
	await page.getByRole('button', { name: 'Create game' }).tap();

	// Straight to the player screen's Grim tab, where the town is set up.
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByRole('tab', { name: 'Grim' })).toHaveAttribute('aria-selected', 'true');
	await pickNumber(page.getByRole('tabpanel'), 'Seats', '6 seats');
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

	// A note written in this game, kept on the phone.
	await page.getByRole('tab', { name: 'Notes' }).tap();
	const notes = page.getByRole('tabpanel');
	await notes.getByTestId('new-note').first().tap();
	await noteTitle(newNoteRow(notes)).fill('Bob claims Chef');
	await leaveNote(page);
	await expect.poll(noteSummaries(notes)).toContain('Bob claims Chef');
	await expect.poll(storedNotes(page)).toContain('Bob claims Chef');

	// A new game on the same script starts on a clear board (Trevor, 2026-11-10: the old
	// town stayed "not even making a new game").
	await page.goto('/new');
	await page.getByRole('combobox', { name: 'Host' }).tap();
	await page.getByRole('option', { name: /^Local Grim/ }).tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/play$/);
	const fresh = page.getByTestId('grim-seat');
	await expect(fresh).toHaveCount(7);
	await expect(fresh.nth(0)).not.toHaveAttribute('aria-label', /dead/);
	// Notes go too: they are "usually associated with actions in a game" (Trevor, 2026-11-10).
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(notes.getByTestId('new-note').first()).toBeVisible();
	await expect.poll(noteSummaries(notes)).not.toContain('Bob claims Chef');
	expect(await storedNotes(page)()).not.toContain('Bob claims Chef');
	await page.goto('/join');
	await expect(page.getByTestId('players-only-games').getByRole('button')).toContainText('7 seats');
});
