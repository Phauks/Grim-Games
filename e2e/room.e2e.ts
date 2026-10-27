import { expect, test, type Page } from '@playwright/test';
import { setPlayerName } from './player-name.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { renderSVG } from 'uqr';
import { nameStoryteller, openGameInfo, toBoard } from './new-game.ts';
import { menuButton } from './shell.ts';
import { aimCamera, qrSrc } from './camera.ts';

// Share's Players tab in a live room (07-accounts-and-multi-device.md §4.2): a phone gives its
// name, the Storyteller picks its seat, and the seat is named in the grimoire. There is no
// approval step (Trevor, 2026-10-26: "we don't approve anymore").

/** Types a room code into Join game's code boxes. */
async function typeCode(phone: Page, code: string) {
	const field = phone.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
}

/** Opens Grim view from Join game with the room code and a password, past the promise. */
async function watchWithPassword(phone: Page, code: string, password: string) {
	await phone.goto('/join');
	await typeCode(phone, code);
	await expect(phone.getByTestId('room-preview')).toContainText('Trouble Brewing');
	await phone.getByRole('button', { name: 'More ways to join' }).tap();
	await phone.getByRole('menuitem', { name: 'Grim view' }).tap();
	const ask = phone.getByRole('dialog', { name: 'Grim view' });
	await ask.getByLabel('Grim view password', { exact: true }).fill(password);
	await ask.getByRole('button', { name: 'Confirm' }).tap();
}

/**
 * Opens the phone's You sheet from the title line (plan E2, Trevor 2026-10-26: "move name into
 * an edit button in the top").
 */
async function seatSheet(phone: Page) {
	await phone.getByTestId('you-button').tap();
	const sheet = phone.getByRole('dialog', { name: 'Your settings' });
	await expect(sheet).toBeVisible();
	return sheet;
}

/** Names a seat on the board, which seats the phone with that name (no seat picking). */
async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

async function startGame(page: Page, storyteller?: string, players = 8) {
	await page.goto('/new');
	const count = page.getByTestId('setup-table').locator('thead th[data-current]');
	for (let n = 8; n < players; n++) {
		await page.getByRole('button', { name: 'More players' }).tap();
		await expect(count).toHaveText(String(n + 1));
	}
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	if (storyteller !== undefined) await nameStoryteller(page, storyteller);
	return new URL(page.url()).pathname;
}

test("Your games shows each room's whole line on a phone, however long the Storyteller's name", async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-10-26: "I can't see all text beneath name of script" when rejoining.
	const board = await startGame(page, 'Trevor Goldsmith');
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await phone.goto('/join');
	const row = phone.getByTestId('recent-rooms').getByRole('button');
	await expect(row).toContainText('Storyteller: Trevor Goldsmith');
	// The code form names no Storyteller before a room is joined (Trevor, 2026-10-26).
	await expect(phone.getByText('Storyteller: Trevor Goldsmith', { exact: true })).toHaveCount(0);
	await expect(row).toContainText(String(new Date().getFullYear()));
	// No line is cut short with an ellipsis.
	const cut = await row
		.locator('.recent-line')
		.evaluateAll((lines) => lines.filter((l) => l.scrollWidth > l.clientWidth).length);
	expect(cut).toBe(0);
	await phoneContext.close();
});

test('a phone joins with a name, and the Storyteller seats it', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	expect(code).toMatch(/^\d{6}$/);
	// The icon beside the code copies the code alone, ungrouped (Trevor, 2026-10-19).
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Copy code' }).tap();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	// The room is one row over the script's tabs, and the You sheet takes only the name: the
	// Storyteller seats each player (Trevor, 2026-10-25: "only player interaction should be what
	// name shows up").
	await expect(phone.getByTestId('join-status')).toHaveText('');
	const sheet = await seatSheet(phone);
	await expect(sheet.getByRole('radio')).toHaveCount(0);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await expect(phone.getByRole('button', { name: 'Your settings: Alex' })).toBeVisible();
	// Joining moves the phone to the script (Trevor, 2026-10-23: "when joining game, spawn on
	// script"); the Room tab keeps the seat's state.
	await expect(phone.getByRole('tab', { name: 'Script' })).toHaveAttribute('aria-selected', 'true');
	// In a room, Share script hands on the room, as the board's does (Trevor, 2026-10-23).
	await phone.getByRole('button', { name: 'Share script' }).tap();
	const passOn = phone.getByRole('dialog', { name: 'Share', exact: true });
	await expect(passOn.getByTestId('share-code')).toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);
	await expect(passOn.getByTestId('share-url')).toHaveValue(new RegExp(`/join#${code}$`));
	await phone.keyboard.press('Escape');
	await expect(passOn).toBeHidden();

	// The phone is listed with no seat straight away. There is no seat picking (Trevor,
	// 2026-10-26): naming a seat on the board with the phone's name seats it.
	const alex = page.getByRole('list', { name: 'Players in the room' }).getByRole('listitem');
	await expect(alex).toHaveText(/^Alex\s*No seat$/);
	await nameSeat(page, 3, 'Alex');

	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '3');
	await expect(phone.getByRole('button', { name: 'Your settings: Alex' })).toBeVisible();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(phone.getByTestId('grim-seat').nth(2)).toHaveAttribute(
		'aria-label',
		/^Seat 3: Alex/
	);
	// A seated player's new name goes on their seat, with no approval either.
	await seatSheet(phone);
	await setPlayerName(phone, 'Alex K');
	await phone.keyboard.press('Escape');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '3');
	await expect(phone.getByRole('button', { name: 'Your settings: Alex K' })).toBeVisible();
	await page.goto(`${board}/room`);
	await expect(alex).toHaveText(/^Alex K\s*Seat 3$/);

	// Coming back (Trevor, 2026-10-19: "it booted me out like I had not joined it yet"): Join
	// game lists the room, and opening it shows the seat this phone already has. Resume game
	// neither lists it (Trevor, 2026-10-23) nor links to Join game (Trevor, 2026-10-24).
	await phone.goto('/games');
	await expect(phone.getByRole('main').getByRole('link', { name: 'Join game' })).toHaveCount(0);
	await phone.goto('/join');
	const recent = phone.getByTestId('recent-rooms').getByRole('button');
	await expect(recent).toHaveCount(1);
	await expect(recent).toContainText('Trouble Brewing');
	await expect(recent).toContainText(`${code.slice(0, 3)} ${code.slice(3)}`);
	// When this phone last opened it.
	await expect(recent).toContainText(String(new Date().getFullYear()));
	await recent.tap();
	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	// A phone with a seat opens on the script.
	await expect(phone.getByRole('tab', { name: 'Script' })).toHaveAttribute('aria-selected', 'true');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '3');
	await expect(phone.getByRole('button', { name: 'Your settings: Alex K' })).toBeVisible();
	const again = await seatSheet(phone);
	await expect(again.getByTestId('player-name')).toHaveText('Alex K');
	await again.getByRole('button', { name: 'Edit your name' }).tap();
	const modal = phone.getByRole('dialog', { name: 'Your name' });
	await expect(modal.getByRole('textbox', { name: 'Your name' })).toHaveValue('Alex K');
	await expect(modal.getByRole('button', { name: 'Save' })).toBeDisabled();
	await modal.getByRole('button', { name: 'Cancel' }).tap();
	await phone.keyboard.press('Escape');

	// Seating, and the new name, named the seat on the board, as ordinary changes.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 3: Alex K"]')).toBeVisible();

	// Under the code: connected, with who is in the room (Trevor, 2026-10-20).
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toHaveText('Connected');
	await expect(page.getByTestId('status-players')).toHaveText('1 player');
	await expect(page.getByTestId('status-watching')).toHaveText('0 watching');
	// New code deletes the old room, sending the phone back to the code form.
	await page.getByRole('button', { name: 'New code' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Make a new code?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(phone.getByRole('alert')).toHaveText('The Storyteller closed this room.');
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	await expect(page.getByTestId('share-code')).not.toHaveText(code.replace(/^(\d{3})/, '$1 '));
	// A closed room leaves the list.
	await phone.goto('/join');
	await expect(phone.getByTestId('recent-rooms')).toHaveCount(0);
	await phoneContext.close();
});

test('End game keeps the room open and tells its phones the game is over', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const status = phone.getByTestId('join-status');
	await expect(status).toHaveText('');

	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');
	// The room stays open, for what comes after, and the phone sees the end as the board does.
	await expect(status).toHaveText('Game over: Good won');
	await expect(phone.getByRole('alert')).toHaveCount(0);
	// A phone coming back still sees it.
	await phone.reload();
	await expect(status).toHaveText('Game over: Good won');

	// Reopening the game runs it again for the phones too.
	await page.getByTestId('game-over').tap();
	await page
		.getByRole('alertdialog', { name: 'Reopen game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(status).toHaveText('');
	await phoneContext.close();
});

test('once the game has ended the Storyteller can close the room, which sends every phone out', async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-10-26: Close room beside New game in ⋯, only after the game has ended.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');

	await page.goto(board);
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(menu.getByRole('button', { name: 'Close room' })).toHaveCount(0);
	await menu.getByRole('button', { name: 'End game' }).tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(page.getByTestId('game-over')).toHaveText('Game over: Good won');

	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(menu.getByRole('button', { name: 'New game' })).toBeVisible();
	await menu.getByRole('button', { name: 'Close room' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Close the room?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(phone.getByRole('alert')).toHaveText('The Storyteller closed this room.');
	// The room is gone: its code opens nothing, and the menu has no Close room.
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('alert')).toHaveText('This room is closed, or the code is wrong.');
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(menu.getByRole('button', { name: 'Close room' })).toHaveCount(0);
	await phoneContext.close();
});

test('after End game a phone rates the game in half stars and sends accolades', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const status = phone.getByTestId('join-status');
	await expect(status).toHaveText('');
	// Hidden until the game is over.
	const rate = phone.getByRole('button', { name: 'Rate game' });
	await expect(rate).toHaveCount(0);

	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(status).toHaveText('Game over: Good won');

	await rate.tap();
	const sheet = phone.getByRole('dialog', { name: 'Rate this game' });
	const send = sheet.getByRole('button', { name: 'Send' });
	await expect(send).toBeDisabled();
	// A second tap on the same star takes off half.
	await sheet.getByRole('button', { name: 'Star 4' }).tap();
	await sheet.getByRole('button', { name: 'Star 4' }).tap();
	await expect(sheet.getByTestId('feedback-rating')).toHaveText('3.5 of 5');
	// Someone else acting in the room meanwhile keeps what is being entered (Trevor's playtest,
	// 2026-10-25: a rating vanished while the table rated at once).
	const otherContext = await browser.newContext({ ...testInfo.project.use });
	const other = await otherContext.newPage();
	await other.goto(`/join/${code}`);
	await expect(other.getByTestId('join-status')).toHaveText('Game over: Good won');
	await other.getByRole('button', { name: 'Rate game' }).tap();
	const otherSheet = other.getByRole('dialog', { name: 'Rate this game' });
	await otherSheet.getByRole('button', { name: 'Star 2' }).tap();
	await otherSheet.getByRole('button', { name: 'Send' }).tap();
	await expect(otherSheet).toHaveCount(0);
	await otherContext.close();
	await expect(sheet.getByTestId('feedback-rating')).toHaveText('3.5 of 5');
	await sheet.getByRole('button', { name: /Great pacing/ }).tap();
	await expect(sheet.getByRole('button', { name: /Great pacing/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(sheet.getByRole('checkbox', { name: 'Anonymous' })).toBeChecked();
	await sheet.getByRole('textbox', { name: 'Comment' }).fill('A great night.');
	await send.tap();
	await expect(sheet).toHaveCount(0);
	// The room keeps what this phone sent, so it opens as sent, after a reload too.
	await phone.reload();
	await rate.tap();
	await expect(sheet.getByTestId('feedback-rating')).toHaveText('3.5 of 5');
	await expect(sheet.getByRole('textbox', { name: 'Comment' })).toHaveValue('A great night.');
	await expect(sheet.getByRole('button', { name: /Great pacing/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await phoneContext.close();

	// The Storyteller reads it from the ended game's menu; it is saved with the game on this
	// device, so it is still there after a reload (Trevor, 2026-10-25).
	const feedback = page.getByTestId('game-feedback');
	async function openFeedback() {
		await page.getByRole('button', { name: 'More', exact: true }).tap();
		await page
			.getByRole('dialog', { name: 'Grimoire' })
			.getByRole('button', { name: 'Player feedback' })
			.tap();
		await expect(feedback).toBeVisible();
	}
	await openFeedback();
	// 3.5 and 2 average to 2.75, shown to the half star.
	await expect(feedback.getByTestId('feedback-average')).toHaveText('3 of 5 from 2 rated');
	await expect(feedback.getByTestId('feedback-accolade-counts')).toHaveText('⏱️ Great pacing × 1');
	const entries = feedback.getByTestId('feedback-entry');
	await expect(entries).toHaveCount(2);
	const entry = entries.filter({ hasText: 'A great night.' });
	await expect(entry).toContainText('Anonymous');
	await expect(entry).toContainText('3.5 of 5');
	await page.reload();
	await openFeedback();
	await expect(entries).toHaveCount(2);
	await expect(entry).toHaveCount(1);
});

test('after End game the Storyteller shares the finished grimoire with the room', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const status = phone.getByTestId('join-status');
	await expect(status).toHaveText('');
	// Not there during the game, where it would do nothing (Trevor, 2026-10-25).
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const finalSwitch = phone.getByRole('checkbox', { name: 'Final grimoire' });
	await expect(phone.getByTestId('player-grim')).toBeVisible();
	await expect(finalSwitch).toHaveCount(0);
	// Only once the game is over.
	await expect(page.getByRole('button', { name: 'Share grim' })).toBeDisabled();

	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Evil', exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(status).toHaveText('Game over: Evil won');

	// The Share sheet offers Share grim once the game is over, and asks first.
	const seats = await page.getByTestId('seat').count();
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	const share = page
		.getByRole('dialog', { name: 'Share', exact: true })
		.getByRole('button', { name: 'Share grim' });
	await share.tap();
	await page
		.getByRole('alertdialog', { name: 'Share the grimoire?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(share).toBeDisabled();
	// The phone shows it on the Grim tab in place of the town (Trevor, 2026-10-24): the whole
	// board, every seat; the switch puts the town and its guesses back.
	const final = phone.getByTestId('final-grimoire');
	await expect(final.getByTestId('seat')).toHaveCount(seats);
	await expect(finalSwitch).toBeChecked();
	await phone.getByText('Final grimoire', { exact: true }).tap();
	await expect(final).toHaveCount(0);
	await expect(phone.getByTestId('player-grim')).toBeVisible();
	// A phone coming back still has it, and turns to the Grim tab for it.
	await phone.reload();
	await expect(phone.getByRole('tab', { name: 'Grim' })).toHaveAttribute('aria-selected', 'true');
	await expect(final.getByTestId('seat')).toHaveCount(seats);

	// Reopening the game makes the grimoire private again.
	await page
		.getByRole('dialog', { name: 'Share', exact: true })
		.getByRole('button', { name: 'Close' })
		.tap();
	await page.getByTestId('game-over').tap();
	await page
		.getByRole('alertdialog', { name: 'Reopen game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(status).toHaveText('');
	await expect(final).toHaveCount(0);
	await expect(finalSwitch).toHaveCount(0);
	await phoneContext.close();
});

test('End game can share the final grimoire, and each phone steps through its History', async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-24): "on game end, storyteller should be given option to push the final
	// grim to the players", and "players should individually be able to scroll through the
	// history".
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');

	// One change to step back over: seat 1 is executed.
	await page.goto(board);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: /^Status of/ })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	const end = page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('combobox', { name: 'Winner' }).tap();
	await page.getByRole('option', { name: 'Good', exact: true }).tap();
	const share = end.getByRole('checkbox', { name: 'Share the final grimoire with players' });
	await expect(share).not.toBeChecked();
	await end.getByText('Share the final grimoire with players', { exact: true }).tap();
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// The phone turns to its Grim tab, where the finished board shows with its History.
	await expect(phone.getByRole('tab', { name: 'Grim' })).toHaveAttribute('aria-selected', 'true');
	const final = phone.getByTestId('final-grimoire');
	const steps = final.getByTestId('history-strip');
	await expect(steps).toBeVisible();
	const count = steps.locator('.count');
	const last = await count.textContent();
	await steps.getByRole('button', { name: 'Previous change' }).tap();
	await expect(count).not.toHaveText(last!);
	// Only on that phone: the Storyteller's board stays at the end.
	await expect(page.getByTestId('history-strip').locator('.count')).toHaveText(last!);
	await phoneContext.close();
});

test('after a game the room votes on the next script, and the next game opens in it', async ({
	page,
	browser
}, testInfo) => {
	// A whole game, then the vote with each of its controls (Trevor, 2026-10-26).
	test.setTimeout(120_000);
	// Trevor, 2026-10-20 (plan R1): the same room for the next game, a script vote by single
	// choice, multiple choice or ranking, and "Storyteller is choosing a script" meanwhile.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const status = phone.getByTestId('join-status');
	await expect(status).toHaveText('');

	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'End game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	await expect(status).toHaveText('Game over');
	const rate = phone.getByRole('button', { name: 'Rate game' });
	await expect(rate).toBeVisible();

	await page.goto('/new');
	await expect(status).toHaveText('The Storyteller is choosing a script.');
	// The next game is being set up, so there is nothing to rate (Trevor, 2026-10-26).
	await expect(rate).toHaveCount(0);
	// Its own screen (Trevor, 2026-10-26: "voting should be its own screen. Not a popup").
	await page.getByRole('link', { name: 'Room vote' }).tap();
	await expect(page).toHaveURL(/\/vote$/);
	const sheet = page.getByRole('main');
	await expect(sheet.getByRole('heading', { name: 'Vote on the next script' })).toBeVisible();
	// Scripts are found with New game's own controls (Trevor, 2026-10-23) and added in turn.
	const scripts = sheet.getByRole('radiogroup', { name: 'Add a script' });
	const add = sheet.getByRole('button', { name: 'Add to vote' });
	const slots = sheet.getByTestId('script-vote-slots').getByRole('listitem');
	// Rows for what is picked and one more, never fewer than two (Trevor, 2026-10-23: "should
	// not be limited to 2 or 3").
	await expect(slots).toHaveText([/^Script 1\s*None\s*$/, /^Script 2\s*None\s*$/]);
	// The room's code from before the vote opens, so players can join first; on a tablet it
	// is in a column of its own beside the scripts (Trevor, 2026-10-23).
	const joinCode = sheet.getByTestId('share-code');
	await expect(joinCode).toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);
	if (testInfo.project.name === 'tablet') {
		const slotsBox = (await sheet.getByTestId('script-vote-slots').boundingBox())!;
		const codeBox = (await joinCode.boundingBox())!;
		expect(codeBox.x).toBeGreaterThan(slotsBox.x + slotsBox.width);
	}
	await add.tap();
	await expect(add).toBeDisabled();
	await scripts.getByText('Bad Moon Rising', { exact: true }).tap();
	await add.tap();
	await scripts.getByText('Sects & Violets', { exact: true }).tap();
	await add.tap();
	await expect(slots).toHaveText([
		/^Script 1\s*Trouble Brewing\s*$/,
		/^Script 2\s*Bad Moon Rising\s*$/,
		/^Script 3\s*Sects & Violets\s*$/,
		/^Script 4\s*None\s*$/
	]);
	await sheet.getByRole('button', { name: 'Remove Sects & Violets' }).tap();
	await expect(slots).toHaveCount(3);
	await expect(slots.nth(2)).toHaveText(/^Script 3\s*None\s*$/);
	await sheet.getByRole('combobox', { name: 'How players vote' }).tap();
	await page.getByRole('option', { name: 'Ranked' }).tap();
	// A time limit (Trevor, 2026-10-23); the room stops taking ballots when it runs out.
	await sheet.getByRole('combobox', { name: 'Time limit' }).tap();
	await page.getByRole('option', { name: '2 min' }).tap();
	await sheet.getByRole('button', { name: 'Open vote' }).tap();
	await expect(sheet.getByTestId('script-vote-count')).toHaveText('Voted: 0 of 1');
	await expect(sheet.getByTestId('script-vote-time')).toHaveText(/^Time left: [12]:\d\d$/);
	// The room's code stays on the vote, for players not in the room yet (Trevor, 2026-10-23).
	await expect(sheet.getByTestId('share-code')).toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);

	// The phone ranks them, then votes (Trevor, 2026-10-26: "I chose my choices but can't
	// vote, change, or review details"); nothing is sent until Vote.
	const ballot = phone.getByTestId('ballot-screen');
	await expect(ballot.getByText('Tap the scripts in order, your favourite first.')).toBeVisible();
	await expect(ballot.getByTestId('script-vote-time')).toHaveText(/^Time left: [12]:\d\d$/);
	const vote = ballot.getByRole('button', { name: 'Vote', exact: true });
	await expect(vote).toBeDisabled();
	await ballot.locator('[aria-pressed]').filter({ hasText: 'Trouble Brewing' }).tap();
	await ballot.locator('[aria-pressed]').filter({ hasText: 'Bad Moon Rising' }).tap();
	await expect(sheet.getByTestId('script-vote-count')).toHaveText('Voted: 0 of 1');
	// Rearranged: a ranking lists its order, and each placed script moves up or down.
	const rows = ballot.getByTestId('script-ballot').getByRole('listitem');
	await expect(rows).toHaveText([/^1\s*Trouble Brewing/, /^2\s*Bad Moon Rising/]);
	await expect(ballot.getByRole('button', { name: 'Move Trouble Brewing up' })).toBeDisabled();
	await ballot.getByRole('button', { name: 'Move Bad Moon Rising up' }).tap();
	await expect(rows).toHaveText([/^1\s*Bad Moon Rising/, /^2\s*Trouble Brewing/]);
	await vote.tap();
	await expect(sheet.getByTestId('script-vote-count')).toHaveText('Voted: 1 of 1');
	const change = ballot.getByRole('button', { name: 'Change vote' });
	await expect(change).toBeDisabled();
	// A ranking is an instant runoff (Trevor, 2026-10-26): a majority of first choices wins.
	const results = sheet.getByTestId('script-vote-results').getByRole('listitem');
	await expect(results.filter({ hasText: 'Bad Moon Rising' })).toContainText('Winner · Votes: 1');
	await expect(results.filter({ hasText: 'Trouble Brewing' })).toContainText('Votes: 0');

	// Each script's details: its author and characters.
	await ballot.getByRole('button', { name: 'Details of Bad Moon Rising' }).tap();
	const details = phone.getByRole('dialog', { name: 'Script details' });
	await expect(details.getByTestId('script-details-name')).toHaveText('Bad Moon Rising');
	await expect(details.getByText('The Pandemonium Institute')).toBeVisible();
	await expect(details.getByTestId('script-characters')).toContainText('Grandmother');
	await details.getByRole('button', { name: 'Close' }).tap();
	await expect(details).toHaveCount(0);
	await expect(ballot).toBeVisible();

	// Backing out takes the ballot back; voting again puts it in.
	await ballot.getByRole('button', { name: 'Withdraw vote' }).tap();
	await expect(sheet.getByTestId('script-vote-count')).toHaveText('Voted: 0 of 1');
	await expect(ballot.getByRole('button', { name: 'Withdraw vote' })).toBeDisabled();
	await ballot.locator('[aria-pressed]').filter({ hasText: 'Bad Moon Rising' }).tap();
	await vote.tap();
	await expect(sheet.getByTestId('script-vote-count')).toHaveText('Voted: 1 of 1');

	// The Storyteller lets players see the count (Trevor, 2026-10-26): the same live stats on
	// both, with who has voted but never what they chose.
	await expect(ballot.getByTestId('vote-stats')).toHaveCount(0);
	await sheet.getByText('Players see the count', { exact: true }).tap();
	const shared = ballot.getByTestId('vote-stats');
	await expect(
		shared.getByRole('listitem').filter({ hasText: 'Bad Moon Rising' }).getByTestId('vote-count')
	).toHaveText('Winner · Votes: 1');
	await expect(shared.getByTestId('script-vote-count')).toHaveText('Voted: 1 of 1');
	await expect(shared.getByTestId('vote-people')).toContainText('Voted');
	await expect(sheet.getByTestId('vote-people')).toContainText('Voted');
	// The runoff's rounds, one by one.
	await sheet.getByRole('button', { name: 'Rounds' }).tap();
	const rounds = page.getByRole('dialog', { name: 'Rounds' });
	await expect(rounds.getByTestId('vote-rounds')).toContainText('Round 1');
	await expect(rounds.getByTestId('vote-rounds')).toContainText(
		'Bad Moon Rising has more than half.'
	);
	await rounds.getByRole('button', { name: 'Close' }).tap();

	// While the vote is open the ballot is the phone's screen, in place of the tabs.
	await expect(phone.getByRole('tab', { name: 'Script' })).toHaveCount(0);

	// No Play while the vote is open (Trevor, 2026-10-26).
	await expect(results.getByRole('button', { name: 'Play' })).toHaveCount(0);

	// One button ends it (Trevor, 2026-10-26: "duplicative end vote and close vote"): phones
	// get a final call ("15 second final vote warning"), then it is New vote.
	await sheet.getByRole('button', { name: 'End vote' }).tap();
	await expect(ballot.getByTestId('script-vote-time')).toHaveText(
		/^Final call: voting closes in 0:1\d$/
	);
	await expect(sheet.getByRole('button', { name: 'End vote' })).toBeDisabled();
	await expect(sheet.getByRole('button', { name: 'New vote' })).toBeVisible({ timeout: 20_000 });
	await expect(sheet.getByRole('button', { name: 'Close vote' })).toHaveCount(0);
	await expect(ballot.getByTestId('script-vote-time')).toHaveText('Voting has closed.');

	// Playing the winner closes the vote and chooses it on New game.
	await results.filter({ hasText: 'Bad Moon Rising' }).getByRole('button', { name: 'Play' }).tap();
	await expect(ballot).toHaveCount(0);
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	// The same room carries the next game: its script, and seats to ask for again.
	await expect(status).toHaveText('');
	await expect(phone.getByRole('heading', { name: 'Bad Moon Rising', level: 1 })).toBeVisible();
	await phoneContext.close();
});

test("a new game in the same room starts the phone's notes and guesses afresh", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-25): "I loaded into a new trouble brewing game, but I had the same
	// scratch notes from a previous game". A phone keeps its notes, pads, guesses and seat
	// notes per game in a room, not per script.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();

	await phone.getByRole('tab', { name: 'Notes' }).tap();
	// The player's own notes, not a seat's (each seat has its own "+ New note" too).
	const myNotes = phone
		.locator('section.collapsible')
		.filter({ has: phone.getByRole('heading', { name: 'My notes' }) });
	await myNotes.getByRole('button', { name: 'New note' }).tap();
	const editor = phone.getByRole('dialog', { name: 'Note', exact: true });
	await editor.getByRole('textbox', { name: 'Title' }).fill('Game one');
	await phone.keyboard.press('Escape');
	await expect(phone.locator('[data-note]').filter({ hasText: 'Game one' })).toHaveCount(1);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await phone.getByTestId('grim-seat').nth(1).tap();
	await phone
		.getByRole('dialog', { name: 'Seat 2 · Seat 2' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await phone.keyboard.press('Escape');
	await expect(phone.getByTestId('grim-seat').nth(1)).toHaveAttribute('data-guess', 'true');

	// The same script again, in the same room.
	await page.goto(board);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game' })
		.tap();
	await page
		.getByRole('alertdialog', { name: 'End game?' })
		.getByRole('button', { name: 'Confirm', exact: true })
		.tap();
	const second = await startGame(page);
	expect(second).not.toBe(board);
	await expect(phone.getByTestId('grim-seat').nth(1)).not.toHaveAttribute('data-guess', 'true');
	await phone.getByRole('tab', { name: 'Notes' }).tap();
	await expect(phone.locator('[data-note]').first()).toBeVisible();
	await expect(phone.locator('[data-note]').filter({ hasText: 'Game one' })).toHaveCount(0);
	await phoneContext.close();
});

test('New game opens a room for the vote before any game or script', async ({
	page,
	browser
}, testInfo) => {
	// Three votes, each ended with its 15-second final call (Trevor, 2026-10-26).
	test.setTimeout(150_000);
	// Trevor, 2026-10-23: "allow storytellers to create rooms without having selected a
	// script", so the table can gather and vote first.
	await page.goto('/new');
	// Its own screen (Trevor, 2026-10-26: "voting should be its own screen. Not a popup").
	await page.getByRole('link', { name: 'Room vote' }).tap();
	await expect(page).toHaveURL(/\/vote$/);
	const sheet = page.getByRole('main');
	await expect(sheet.getByRole('heading', { name: 'Vote on the next script' })).toBeVisible();
	const joinCode = sheet.getByTestId('share-code');
	await expect(joinCode).toHaveText(/^\d{3} \d{3}$/);
	const code = (await joinCode.textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText(
		'The Storyteller is choosing a script.'
	);

	await sheet.getByRole('button', { name: 'Add to vote' }).tap();
	await sheet
		.getByRole('radiogroup', { name: 'Add a script' })
		.getByText('Bad Moon Rising', { exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add to vote' }).tap();
	await sheet.getByRole('button', { name: 'Open vote' }).tap();
	const ballot = phone.getByTestId('ballot-screen');
	await ballot.locator('[aria-pressed]').filter({ hasText: 'Bad Moon Rising' }).tap();
	await ballot.getByRole('button', { name: 'Vote', exact: true }).tap();
	await expect(sheet.getByTestId('script-vote-count')).toHaveText('Voted: 1 of 1');
	// Ended with its final call, then New vote takes it off the phones.
	await sheet.getByRole('button', { name: 'End vote' }).tap();
	await sheet.getByRole('button', { name: 'New vote' }).tap({ timeout: 20_000 });
	await expect(ballot).toHaveCount(0);

	// Back to New game for a Storyteller who decides not to use the vote (Trevor, 2026-10-26);
	// an open vote is cancelled on the way, so it leaves the phones too.
	await sheet.getByRole('button', { name: 'Back', exact: true }).tap();
	await expect(page).toHaveURL(/\/new$/);
	await page.getByRole('link', { name: 'Room vote' }).tap();
	await sheet.getByRole('button', { name: 'Add to vote' }).tap();
	await sheet
		.getByRole('radiogroup', { name: 'Add a script' })
		.getByText('Bad Moon Rising', { exact: true })
		.tap();
	await sheet.getByRole('button', { name: 'Add to vote' }).tap();
	await sheet.getByRole('button', { name: 'Open vote' }).tap();
	await expect(ballot).toBeVisible();
	await sheet.getByRole('button', { name: 'Cancel vote' }).tap();
	await expect(page).toHaveURL(/\/new$/);
	await expect(ballot).toHaveCount(0);
	await page.getByRole('link', { name: 'Room vote' }).tap();

	// A vote on the game mode the same way (Trevor, 2026-10-23), five of them: not capped at
	// two or three. Its winner becomes New game's mode.
	await sheet.getByRole('combobox', { name: 'Vote on' }).tap();
	await page.getByRole('option', { name: 'Game mode' }).tap();
	const modeSheet = page.getByRole('main');
	await expect(modeSheet.getByRole('heading', { name: 'Vote on the game mode' })).toBeVisible();
	const add = modeSheet.getByRole('button', { name: 'Add to vote' });
	const modes = modeSheet.getByRole('combobox', { name: 'Add a game mode' });
	await add.tap();
	for (const name of ['Sushi Buffet', 'Whale Buffet', 'Two games at once', 'Flesh and Bone']) {
		await modes.tap();
		await page.getByRole('option', { name, exact: true }).tap();
		await add.tap();
	}
	await expect(modeSheet.getByTestId('script-vote-slots').getByRole('listitem')).toHaveText([
		/^Mode 1\s*Standard\s*$/,
		/^Mode 2\s*Sushi Buffet\s*$/,
		/^Mode 3\s*Whale Buffet\s*$/,
		/^Mode 4\s*Two games at once\s*$/,
		/^Mode 5\s*Flesh and Bone\s*$/,
		/^Mode 6\s*None\s*$/
	]);
	await modeSheet.getByRole('button', { name: 'Open vote' }).tap();
	const modeBallot = phone.getByTestId('ballot-screen');
	await expect(modeBallot.getByRole('heading', { name: 'Vote on the game mode' })).toBeVisible();
	await expect(modeBallot.getByText('Pick the game mode you want to play next.')).toBeVisible();
	await expect(modeBallot.getByTestId('script-ballot').getByRole('listitem')).toHaveCount(5);
	await modeBallot.locator('[aria-pressed]').filter({ hasText: 'Sushi Buffet' }).tap();
	await modeBallot.getByRole('button', { name: 'Vote', exact: true }).tap();
	// A game mode has no script details.
	await expect(modeBallot.getByRole('button', { name: /^Details of/ })).toHaveCount(0);
	const results = modeSheet.getByTestId('script-vote-results').getByRole('listitem');
	await expect(results.filter({ hasText: 'Sushi Buffet' })).toContainText('Votes: 1');
	// Play comes once the vote has ended, after its final call.
	await expect(results.getByRole('button', { name: 'Play' })).toHaveCount(0);
	await modeSheet.getByRole('button', { name: 'End vote' }).tap();
	await expect(modeSheet.getByRole('button', { name: 'New vote' })).toBeVisible({
		timeout: 20_000
	});
	await results.filter({ hasText: 'Sushi Buffet' }).getByRole('button', { name: 'Play' }).tap();
	await expect(modeBallot).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Game mode' })).toHaveText(/Sushi Buffet/);

	// A vote on the special rules (Trevor, 2026-10-26: "Voting should allow selecting game
	// modes vs scripts, along with special rules"). Rules stack, so the Storyteller keeps the
	// rules the count favours, or any others, and plays them together.
	await page.getByRole('combobox', { name: 'Game mode' }).tap();
	await page.getByRole('option', { name: 'Standard', exact: true }).tap();
	await page.getByRole('link', { name: 'Room vote' }).tap();
	await sheet.getByRole('combobox', { name: 'Vote on' }).tap();
	await page.getByRole('option', { name: 'Special rules' }).tap();
	await expect(sheet.getByRole('heading', { name: 'Vote on special rules' })).toBeVisible();
	const addRule = sheet.getByRole('button', { name: 'Add to vote' });
	await addRule.tap();
	await sheet.getByRole('combobox', { name: 'Add a special rule' }).tap();
	await page.getByRole('option', { name: 'The Warrens', exact: true }).tap();
	await addRule.tap();
	await expect(sheet.getByTestId('script-vote-slots').getByRole('listitem')).toHaveText([
		/^Rule 1\s*\+1\s*$/,
		/^Rule 2\s*The Warrens\s*$/,
		/^Rule 3\s*None\s*$/
	]);
	await sheet.getByRole('combobox', { name: 'How players vote' }).tap();
	await page.getByRole('option', { name: 'Multiple choice' }).tap();
	await sheet.getByRole('button', { name: 'Open vote' }).tap();
	const ruleBallot = phone.getByTestId('ballot-screen');
	await expect(ruleBallot.getByRole('heading', { name: 'Vote on special rules' })).toBeVisible();
	await expect(
		ruleBallot.getByText('Pick every special rule you would play with next.')
	).toBeVisible();
	await expect(ruleBallot.getByRole('button', { name: /^Details of/ })).toHaveCount(0);
	await ruleBallot.locator('[aria-pressed]').filter({ hasText: '+1' }).tap();
	await ruleBallot.getByRole('button', { name: 'Vote', exact: true }).tap();
	const ruleResults = sheet.getByTestId('script-vote-results').getByRole('listitem');
	await expect(ruleResults.filter({ hasText: '+1' })).toContainText('Votes: 1');
	await sheet.getByRole('button', { name: 'End vote' }).tap();
	const playRules = sheet.getByRole('button', { name: 'Play with these rules' });
	await expect(playRules).toBeVisible({ timeout: 20_000 });
	// The winner is kept to start with; the Storyteller adds The Warrens too.
	await expect(sheet.getByRole('checkbox', { name: 'Play with +1' })).toBeChecked();
	const warrens = sheet.getByRole('checkbox', { name: 'Play with The Warrens' });
	await expect(warrens).not.toBeChecked();
	await ruleResults
		.filter({ hasText: 'The Warrens' })
		.locator('[data-scope="switch"][data-part="control"]')
		.tap();
	await expect(warrens).toBeChecked();
	await playRules.tap();
	await expect(page).toHaveURL(/\/new$/);
	await expect(ruleBallot).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Special rules 2' })).toBeVisible();

	await phoneContext.close();
});

test('the Storyteller picks what goes in the middle of the QR code', async ({ page }, testInfo) => {
	// Trevor, 2026-10-20 (plan R1): a custom QR centre logo, or none.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const qr = page.getByRole('img', { name: 'QR code to join the room' });
	await expect(qr.getByTestId('script-logo')).toHaveAttribute('data-logo', '/data/logos/tb.webp');

	// A dialog with the QR code beside its settings, or on top of them on a phone (Trevor,
	// 2026-10-23, 2026-10-24), which shows each change at once.
	const centre = page.getByRole('dialog', { name: 'QR code settings' });
	await page.getByRole('button', { name: 'QR code settings' }).first().tap();
	const preview = centre
		.getByTestId('qr-preview')
		.getByRole('img', { name: 'QR code to join the room' });
	await expect(preview.getByTestId('script-logo')).toBeVisible();
	const previewBox = (await centre.getByTestId('dialog-aside').boundingBox())!;
	const settingsBox = (await centre.getByTestId('dialog-pane').boundingBox())!;
	if (testInfo.project.name === 'tablet') {
		expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(settingsBox.x);
	} else {
		expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(settingsBox.y);
	}
	await centre.getByRole('combobox', { name: 'QR code centre' }).tap();
	await page.getByRole('option', { name: 'None' }).tap();
	await expect(preview.getByTestId('script-logo')).toHaveCount(0);
	await expect(qr.getByTestId('script-logo')).toHaveCount(0);

	// Picking Your picture opens nothing by itself (Trevor, 2026-10-23); Choose picture does.
	let asked = false;
	page.on('filechooser', () => (asked = true));
	await centre.getByRole('combobox', { name: 'QR code centre' }).tap();
	await page.getByRole('option', { name: 'Your picture' }).tap();
	await expect(centre.getByRole('combobox', { name: 'QR code centre' })).toHaveText(/Your picture/);
	expect(asked).toBe(false);
	// The picture's shape waits, shown but off, until there is a picture.
	const corners = centre.getByRole('combobox', { name: 'Picture corners' });
	await expect(corners).toBeDisabled();
	const chooser = page.waitForEvent('filechooser');
	await centre.getByRole('button', { name: 'Choose picture' }).tap();
	await (
		await chooser
	).setFiles({
		name: 'me.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
			'base64'
		)
	});
	const picture = preview.getByTestId('qr-picture');
	await expect(picture.locator('img')).toHaveAttribute('src', /^data:image\/png/);
	await expect(centre.getByRole('button', { name: 'Change picture' })).toBeEnabled();

	// Its shape, and the code's own squares, change the QR beside them at once.
	await expect(picture).toHaveAttribute('data-corners', 'rounded');
	await corners.tap();
	await page.getByRole('option', { name: 'Round', exact: true }).tap();
	await expect(picture).toHaveAttribute('data-corners', 'circle');
	await centre.getByText('Show the whole picture', { exact: true }).tap();
	await expect(picture).toHaveAttribute('data-whole', 'true');
	const pattern = preview.getByTestId('qr-pattern');
	const squares = await pattern.getAttribute('d');
	await centre.getByRole('combobox', { name: 'QR squares' }).tap();
	await page.getByRole('option', { name: 'Dots' }).tap();
	await expect(pattern).not.toHaveAttribute('d', squares!);
	await expect(pattern).toHaveAttribute('d', /a0\.5,0\.5/);

	// An open list closes when the dialog scrolls under it, rather than riding over its edge;
	// the QR code stays on top as the settings scroll (Trevor, 2026-10-23).
	await centre.getByRole('combobox', { name: 'QR corner markers' }).tap();
	await expect(page.getByRole('listbox')).toBeVisible();
	await page.screenshot({ path: test.info().outputPath('qr-settings-open.png') });
	const settings = centre.getByTestId('dialog-pane');
	const scrolls = await settings.evaluate((el) => el.scrollHeight > el.clientHeight);
	if (scrolls) {
		// Tapping the list scrolled it into view, so scroll whichever way is left.
		await settings.evaluate((el) => el.scrollTo(0, el.scrollTop > 0 ? 0 : el.scrollHeight));
		await expect(page.getByRole('listbox')).toHaveCount(0);
		await page.screenshot({ path: test.info().outputPath('qr-settings-scrolled.png') });
		await expect(preview).toBeInViewport({ ratio: 1 });
	}
	await page.keyboard.press('Escape');

	// It stays on this device.
	await page.reload();
	await expect(qr.getByTestId('qr-picture').locator('img')).toHaveAttribute(
		'src',
		/^data:image\/png/
	);
	await expect(qr.getByTestId('qr-picture')).toHaveAttribute('data-corners', 'circle');
});

test('a phone that joins gets the game script before anyone has a seat', async ({
	page,
	browser
}, testInfo) => {
	// A game with no characters assigned yet: the room can open while the game is in setup.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	// The link opens the player view on its Room tab, and the room's script becomes its script
	// (Trevor, 2026-10-19: no separate room page, then "Read the script").
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await expect(phone.getByRole('tab', { name: 'Script' })).toHaveAttribute('aria-selected', 'true');
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await phone.getByRole('tab', { name: 'Script' }).tap();
	await expect(phone.getByRole('tabpanel', { name: 'Script' })).toBeVisible();
	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	await phoneContext.close();
});

test('a join screen shows nothing from the phone until the room sends its script', async ({
	page,
	browser
}, testInfo) => {
	// Plan J1 (Trevor, 2026-10-22): "when joining game, there should be no other information
	// available". The phone last used Bad Moon Rising; the room plays Trouble Brewing.
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto('/play#e=bmr');
	await expect(phone.getByRole('heading', { name: 'Bad Moon Rising', level: 1 })).toBeVisible();
	// A code no room has: only the join form, none of the phone's own script.
	await phone.goto('/join/000000');
	await expect(phone.getByRole('heading', { name: 'Join game', level: 1 })).toBeVisible();
	await expect(phone.getByRole('tab')).toHaveCount(0);
	await expect(phone.getByText('Bad Moon Rising')).toHaveCount(0);

	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await phone.goto(`/join/${code}`);
	// Once in the room, its script, and only that.
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await phone.getByRole('tab', { name: 'Script' }).tap();
	await expect(phone.getByRole('tabpanel', { name: 'Script' })).not.toContainText(
		'Bad Moon Rising'
	);
	await phoneContext.close();
});

test('Share and Copy link carry the room code as well as the link', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.addInitScript(() => {
		const w = window as unknown as { shared?: ShareData };
		Object.defineProperty(navigator, 'share', {
			configurable: true,
			value: async (data: ShareData) => void (w.shared = data)
		});
	});
	const board = await startGame(page, 'Sam');
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\D/g, '');
	expect(code).toMatch(/^\d{6}$/);
	const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
	// The room's one link (Trevor, 2026-10-26): Join game, its code in the hash.
	const link = new RegExp(`/join#${code}$`);
	// The game's script logo sits in the middle of the join QR (Trevor, 2026-10-19).
	const qr = page.getByRole('img', { name: 'QR code to join the room' });
	await expect(qr.getByTestId('script-logo')).toHaveAttribute('data-logo', '/data/logos/tb.webp');
	await expect(qr.getByTestId('qr-name')).toHaveCount(0);

	await page.getByRole('button', { name: 'Share', exact: true }).first().tap();
	const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
	expect(shared.text).toContain(spaced);
	// The text names the game as its byline does (Trevor, 2026-10-19).
	expect(shared.text).toContain(
		`Join the game on ${APP_NAME}: Trouble Brewing by The Pandemonium Institute · Storyteller: Sam.`
	);
	expect(shared.url).toMatch(link);

	await page.getByRole('button', { name: 'Copy link' }).first().tap();
	const copied = await page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toContain(spaced);
	expect(copied.split('\n').at(-1)).toMatch(link);

	// It opens Join game with the code filled in, so whoever opens it picks how to join.
	const opened = await context.newPage();
	await opened.goto(shared.url!);
	await expect(opened.getByTestId('room-preview')).toContainText('Trouble Brewing');
	await expect(opened.getByRole('button', { name: 'Join as player' })).toBeEnabled();
	await expect(opened.getByTestId('join-status')).toHaveCount(0);
	await opened.close();
});

test('a phone can type a code, and wrong codes say so', async ({ page }) => {
	await page.goto('/join/12345');
	await expect(page.getByRole('alert')).toHaveText(
		'That is not a room code. Codes are six digits.'
	);
	await page.goto('/join');
	const join = page.getByRole('button', { name: 'Join as player' });
	await expect(join).toBeDisabled();
	await page.getByRole('textbox', { name: 'Room code from the Storyteller' }).fill('000 001');
	// No room has this code, so the page says so before anyone joins (Trevor, 2026-10-19).
	await expect(page.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await expect(join).toBeDisabled();
});

test('a typed code shows the game it opens before the phone joins', async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-19): "you type in the code, and then it shows you what game you will be joining".
	const board = await startGame(page, 'Sam');
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto('/join');
	const preview = phone.getByTestId('room-preview');
	const join = phone.getByRole('button', { name: 'Join as player' });
	const before = (await preview.boundingBox())!;
	const field = phone.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
	await expect(preview.getByText('Trouble Brewing', { exact: true })).toBeVisible();
	await expect(preview.getByTestId('script-logo')).toHaveAttribute(
		'data-logo',
		'/data/logos/tb.webp'
	);
	await expect(preview).toContainText('8 seats, 0 taken');
	await expect(preview.getByTestId('game-storyteller')).toHaveText('Storyteller: Sam');
	// The game fills space kept for it: nothing moves.
	expect((await preview.boundingBox())!.height).toBeCloseTo(before.height, 0);
	// The code boxes sit in the middle of the page.
	const boxes = phone.locator('.code-field .box');
	const first = (await boxes.first().boundingBox())!;
	const last = (await boxes.last().boundingBox())!;
	const page_ = phone.viewportSize()!;
	expect(Math.abs((first.x + last.x + last.width) / 2 - page_.width / 2)).toBeLessThan(
		page_.width / 8
	);
	await join.tap();
	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await expect(phone.getByTestId('script-byline')).toContainText('Storyteller: Sam');
	// The player's script names the Storyteller too (Trevor, 2026-10-19).
	await phone.goto('/play');
	await expect(phone.getByTestId('script-byline')).toContainText('Storyteller: Sam');
	await phoneContext.close();
});

test('Join game in the menu takes a typed code, with spaces, and says when no game has it', async ({
	page
}) => {
	await page.goto('/');
	await menuButton(page).tap();
	await page.getByRole('link', { name: 'Join game' }).tap();
	await expect(page).toHaveURL(/\/join$/);
	await expect(page.getByRole('heading', { name: 'Join game', level: 1 })).toBeVisible();
	// Nothing to print or share before a game is joined, so neither shows (Trevor, 2026-10-23).
	for (const name of ['Print script', 'Share script'])
		await expect(page.getByRole('button', { name })).toHaveCount(0);
	const field = page.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.fill(' 482-913 ');
	// No room has this code, so the screen says so in place and Enter doesn't leave it.
	await expect(page.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/join$/);
	await expect(field).toHaveValue('482913');
});

test('the room code goes in one box per digit, and takes no more than the code holds', async ({
	page
}) => {
	// Trevor (2026-10-18): limit entry to the code's real length, with a box for each digit.
	await page.goto('/join');
	const field = page.getByRole('textbox', { name: 'Room code from the Storyteller' });
	const boxes = page.locator('.code-field .box');
	const join = page.getByRole('button', { name: 'Join as player' });
	await expect(boxes).toHaveCount(6);
	await field.tap();
	await field.pressSequentially('48291');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '']);
	await expect(join).toBeDisabled();
	// Letters are dropped, and a seventh digit doesn't fit.
	await field.pressSequentially('x37');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '3']);
	await expect(field).toHaveValue('482913');
	// A full code is looked up; no room has this one.
	await expect(page.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await expect(join).toBeDisabled();
	// Backspace steps back one box.
	await field.press('Backspace');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '']);
	// A pasted code fills every box, spaces and all.
	await page.getByRole('button', { name: 'Clear' }).tap();
	await expect(boxes).toHaveText(['', '', '', '', '', '']);
	await field.focus();
	await field.fill('482 913');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '3']);
	// The boxes fit beside each other on a phone, and the X sits after the last one.
	const last = (await boxes.last().boundingBox())!;
	const clear = (await page.getByRole('button', { name: 'Clear' }).boundingBox())!;
	expect(clear.x).toBeGreaterThanOrEqual(last.x + last.width - 1);
	expect(
		new Set(await boxes.evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().top))))
			.size
	).toBe(1);
});

test('the Worker refuses bad room requests', async ({ request }) => {
	expect((await request.get('/api/room/ABCDEF')).status()).toBe(400);
	expect((await request.post('/api/rooms', { data: { hostKeyHash: 'nope' } })).status()).toBe(400);
	expect((await request.get('/api/rooms')).status()).toBe(405);
});

test('a room tells an app too old for it to update', async ({ page, browser }, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\D/g, '');

	// The real Worker turns away a hello in a protocol older than it accepts.
	const reply = await page.evaluate(
		(url) =>
			new Promise<string>((done) => {
				const ws = new WebSocket(url);
				ws.onopen = () =>
					ws.send(
						JSON.stringify({ type: 'hello', role: 'player', key: 'a'.repeat(64), protocol: 0 })
					);
				ws.onmessage = (event) => done(String(event.data));
			}),
		`${new URL(page.url()).origin.replace(/^http/, 'ws')}/api/room/${code}`
	);
	expect(JSON.parse(reply)).toEqual({ type: 'refused', reason: 'too-old' });

	// A phone told so says what to do instead of "closed or wrong".
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.routeWebSocket(/\/api\/room\//, (ws) => {
		ws.onMessage(() => ws.send(JSON.stringify({ type: 'refused', reason: 'too-old' })));
	});
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('alert')).toHaveText(
		`This room needs a newer version of ${APP_NAME}. Refresh to update, then try again.`
	);
	await phoneContext.close();
});

test('a phone built before the Storyteller app looks for the update, and plays on', async ({
	page
}) => {
	// Trevor, 2026-10-26: an older app is nudged to update, never blocked.
	await page.addInitScript(() => {
		const looks = { count: 0 };
		Object.assign(window, { looks });
		const update = ServiceWorkerRegistration.prototype.update;
		ServiceWorkerRegistration.prototype.update = function () {
			looks.count++;
			return update.call(this);
		};
	});
	// The service worker from an earlier visit is in place, as it is on a phone that has the app.
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.routeWebSocket(/\/api\/room\//, (ws) => {
		ws.onMessage(() =>
			ws.send(
				JSON.stringify({
					type: 'player-view',
					me: { memberId: 'me' },
					takenSeats: [],
					storytellerBuiltAt: '2999-01-01T00:00:00.000Z'
				})
			)
		);
	});
	await page.goto('/join/123456');
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { looks: { count: number } }).looks.count)
		)
		.toBeGreaterThan(0);
	// Nothing is blocked: the join form is still there to use.
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a grimoire from a newer Storyteller app asks to update', async ({ page }) => {
	// Trevor, 2026-10-26: an older app is nudged to update, never blocked.
	await page.routeWebSocket(/\/api\/room\//, (ws) => {
		ws.onMessage(() =>
			ws.send(
				JSON.stringify({
					type: 'grimoire',
					grimoire: { saved: { schemaVersion: 9999, gameId: 'newer' } }
				})
			)
		);
	});
	await page.goto(`/watch/123456#${'a'.repeat(64)}`);
	await page
		.getByRole('alertdialog', { name: 'Before you watch' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByTestId('watch-status').getByRole('alert')).toHaveText(
		`The Storyteller has a newer version of ${APP_NAME}. Refresh to update and see the grimoire.`
	);
});

test('the room code and a Grim view password open the grimoire, a new password each game', async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-10-22 (plan D1): "grim view by password or direct link. drop spectate"; and
	// 2026-10-26: "access password locked by storyteller instead, and default to a new password
	// per game (that can be customizable)".
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const watch = page.getByTestId('watch-link');
	// A password field (Trevor, 2026-10-22): masked, with an eye button that shows it.
	const password = watch.getByLabel('Grim view password', { exact: true });
	await expect(password).toHaveAttribute('type', 'password');
	// In the plain account font, not the capitals-only control font, so case reads exactly.
	await expect(password).not.toHaveCSS('font-family', /Cinzel/);
	// In its place, but off while Grim view is.
	await expect(password).toBeDisabled();
	const copy = watch.getByRole('button', { name: 'Copy password' });
	await expect(copy).toBeDisabled();
	// No QR or link of its own (Trevor, 2026-10-26).
	await expect(watch.getByRole('img')).toHaveCount(0);
	await expect(watch.getByTestId('share-url')).toHaveCount(0);

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto('/join');
	const grimView = phone.getByRole('menuitem', { name: 'Grim view' });
	// Grim view waits behind ⋯, so Join as player is the one big button (Trevor, 2026-10-26).
	const more = phone.getByRole('button', { name: 'More ways to join' });
	await typeCode(phone, code);
	await expect(phone.getByTestId('room-preview')).toContainText('Trouble Brewing');
	// Grim view off: only joining as a player.
	await expect(phone.getByRole('button', { name: 'Join as player' })).toBeEnabled();
	await expect(grimView).toHaveCount(0);
	await more.tap();
	await expect(grimView).toBeDisabled();
	await phone.keyboard.press('Escape');

	// On, it comes with a password of its own for this game.
	await watch.getByText('Grim view', { exact: true }).tap();
	await expect(password).toBeEnabled();
	await expect(password).toHaveValue(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
	const made = await password.inputValue();
	// Copy beside it copies the password itself (Trevor, 2026-10-27).
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await copy.tap();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(made);
	const eye = watch.getByRole('button', { name: 'Show password' });
	await eye.tap();
	await expect(password).toHaveAttribute('type', 'text');
	await expect(eye).toHaveAttribute('aria-pressed', 'true');
	await eye.tap();
	await expect(password).toHaveAttribute('type', 'password');

	// A wrong password says so.
	await phone.reload();
	await typeCode(phone, code);
	await more.tap();
	await expect(grimView).toBeEnabled();
	await grimView.tap();
	const ask = phone.getByRole('dialog', { name: 'Grim view' });
	const typed = ask.getByLabel('Grim view password', { exact: true });
	await expect(typed).toHaveAttribute('type', 'password');
	await expect(typed).not.toHaveCSS('font-family', /Cinzel/);
	await expect(ask.getByRole('button', { name: 'Show password' })).toBeVisible();
	await typed.fill('candle');
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	const pledge = phone.getByRole('alertdialog', { name: 'Before you watch' });
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(
		phone.getByText('Wrong password, or the Storyteller has turned Grim view off.')
	).toBeVisible();

	// The one it made opens the grimoire.
	await watchWithPassword(phone, code, made);
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(phone.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();

	// The Storyteller can type their own instead; the old one stops.
	await password.fill('lantern');
	await password.press('Enter');
	await expect(phone.getByRole('button', { name: /^Seat 1:/ })).toHaveCount(0);
	await watchWithPassword(phone, code, 'lantern');
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(phone.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();

	// The next game gets a new one.
	const next = await startGame(page);
	await page.goto(`${next}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(password).toHaveValue(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
	expect(await password.inputValue()).not.toBe('lantern');
	expect(await password.inputValue()).not.toBe(made);
	await phoneContext.close();
});

test('a spectator watches the whole grimoire with Grim view, after promising', async ({
	page,
	browser
}, testInfo) => {
	// Specters (Trevor, 2026-10-18): spectators see the Storyteller's grimoire live, with the
	// room code and a password the Storyteller turns on and off, after promising not to spoil
	// the game.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	// On the same screen as the players' code, with no tabs (Trevor, 2026-10-22).
	await expect(page.getByRole('tab')).toHaveCount(0);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const watch = page.getByTestId('watch-link');
	const toggle = watch.getByRole('checkbox', { name: 'Grim view' });
	// The switch is tapped by its label, as the whole row is one tap target.
	const flip = () => watch.getByText('Grim view', { exact: true }).tap();
	const password = watch.getByLabel('Grim view password', { exact: true });
	// Off until turned on, with its place kept.
	await expect(toggle).not.toBeChecked();
	await expect(password).toHaveValue('');
	await flip();
	await expect(password).toHaveValue(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
	const made = await password.inputValue();

	const viewerContext = await browser.newContext({ ...testInfo.project.use });
	const viewer = await viewerContext.newPage();
	await watchWithPassword(viewer, code, made);
	const pledge = viewer.getByRole('alertdialog', { name: 'Before you watch' });
	await expect(pledge.getByTestId('watch-pledge').getByRole('listitem')).toHaveCount(3);
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(viewer.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();
	// Every control that changes the game is there but disabled (Trevor, 2026-10-19), so
	// nothing invites a try; what only reads still opens. The board says it is view-only.
	const toolbar = viewer.getByRole('toolbar', { name: 'Grimoire' });
	await expect(toolbar.getByTestId('view-only')).toHaveText('View-Only');
	for (const name of ['Day', 'Info tokens', 'Share', 'More'])
		await expect(toolbar.getByRole('button', { name, exact: true })).toBeDisabled();
	await expect(toolbar.getByRole('button', { name: 'Script', exact: true })).toBeEnabled();
	const timer = viewer.getByTestId('day-timer');
	await expect(timer).toBeVisible();
	// The app's sidebar stays beside the watched board, so a spectator can leave and come back
	// (Trevor, 2026-10-25); its hamburger is then the only one. Narrow, the toolbar's opens the menu.
	const sidebar = viewer.getByRole('navigation', { name: 'Menu', exact: true });
	const size = viewer.viewportSize()!;
	await viewer.setViewportSize({ width: 1280, height: 800 });
	await expect(sidebar).toBeVisible();
	await expect(viewer.getByRole('button', { name: 'Menu', exact: true })).toHaveCount(1);
	await expect(viewer.getByRole('button', { name: /^Seat 1:/ })).toBeInViewport();
	await viewer.setViewportSize(size);
	await expect(sidebar).toBeHidden();
	await expect(toolbar.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
	for (const button of await timer.getByRole('button').all()) await expect(button).toBeDisabled();
	await viewer.getByRole('button', { name: /^Seat 1:/ }).tap();
	await expect(
		viewer.locator(
			'[data-part="content"][data-state="open"]:is([data-scope="dialog"], [data-scope="drawer"])'
		)
	).toHaveCount(0);
	await expect(viewer.getByText('Only the Storyteller can change this game.')).toHaveCount(0);
	// Game info, from the corner where it shows, has no pencil for a viewer.
	const corner = viewer.getByTestId('mode-menu');
	if (await corner.isVisible()) {
		await corner.tap();
		await expect(viewer.getByRole('dialog', { name: 'Game info', exact: true })).toBeVisible();
		await expect(viewer.getByTestId('game-info-edit')).toHaveCount(0);
		await viewer.keyboard.press('Escape');
	}

	// The Storyteller's changes show live.
	await page.goto(board);
	// The board shows an eye and how many watch, above the script name (Trevor, 2026-10-22),
	// wherever the corner has room for the name; never on the viewer's own board.
	const title = page.getByTestId('script-title');
	if (await title.isVisible())
		await expect(title.getByTestId('board-watchers')).toHaveAccessibleName('1 watching');
	await expect(viewer.getByTestId('board-watchers')).toHaveCount(0);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Alex');
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await expect(viewer.getByRole('button', { name: /^Seat 1: Alex/ })).toBeVisible();

	// The viewer's timer follows the Storyteller's (Trevor, 2026-10-19).
	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	const watched = viewer.getByTestId('day-timer');
	await expect(watched).not.toHaveAttribute('data-running');
	await page.getByTestId('day-timer').getByRole('button', { name: 'Start timer' }).tap();
	await expect(watched).toHaveAttribute('data-running', '');
	const clock = watched.getByRole('timer');
	const first = await clock.textContent();
	await expect(clock).not.toHaveText(first ?? '');
	await page.getByTestId('day-timer').getByRole('button', { name: 'Pause timer' }).tap();
	await expect(watched).not.toHaveAttribute('data-running');
	await expect(clock).toHaveText(
		(await page.getByTestId('day-timer').getByRole('timer').textContent()) ?? ''
	);

	// The board's background is the Storyteller's, not the viewer's own (Trevor, 2026-10-26).
	await expect(viewer.getByTestId('board-background')).toHaveCount(0);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('group', { name: 'Background', exact: true })
		.getByRole('button', { name: 'Green felt' })
		.tap();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(viewer.getByTestId('board-background')).toHaveAttribute('data-preset', 'felt');
	// A picture of the Storyteller's own reaches it through the room too.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	await settings.getByLabel('Background image file').setInputFiles({
		name: 'table.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNoUFAAIgYIBQAWjgMBwmTFJwAAAABJRU5ErkJggg==',
			'base64'
		)
	});
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(viewer.getByTestId('board-background')).toHaveAttribute(
		'style',
		/\/api\/room\/\d{6}\/image\/[0-9a-f]{64}/
	);

	// A seat opens its character to read, never the seat sheet.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: /^Character for / })
		.getByRole('button', { name: 'Washerwoman', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(viewer.getByRole('button', { name: /^Seat 1: Alex.*Washerwoman/ })).toBeVisible();
	await viewer.getByRole('button', { name: /^Seat 1:/ }).tap();
	await expect(viewer.getByRole('dialog', { name: 'Washerwoman' })).toBeVisible();
	await expect(
		viewer.locator('[data-scope="drawer"][data-part="content"][data-state="open"]')
	).toHaveCount(0);
	await viewer.keyboard.press('Escape');

	// Every open asks again.
	await viewer.reload();
	await expect(pledge).toBeVisible();
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(viewer.getByRole('button', { name: /^Seat 1: Alex/ })).toBeVisible();

	// Turning it off takes the grimoire away at once; turning it on again makes a new password.
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	// The players' tab says one is watching, by a dot that shows it is connected.
	await expect(page.getByTestId('connection-dot')).toBeVisible();
	await expect(page.getByTestId('status-players')).toHaveText('0 players');
	await expect(page.getByTestId('status-watching')).toHaveText('1 watching');
	// New password replaces it in one step, letting the viewer go (Trevor, 2026-10-20).
	await watch.getByRole('button', { name: 'New password' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Make a new password?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(viewer.getByRole('button', { name: /^Seat 1:/ })).toHaveCount(0);
	await expect(password).toHaveValue(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
	expect(await password.inputValue()).not.toBe(made);
	await expect(page.getByTestId('status-watching')).toHaveText('0 watching');
	await flip();
	await expect(password).toHaveValue('');
	await expect(password).toBeDisabled();
	await flip();
	await expect(password).toHaveValue(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
	await viewerContext.close();
});

test('a view-only link cut short says so and connects to nothing', async ({ page }) => {
	await page.goto('/watch/123456');
	await expect(page.getByRole('alert')).toHaveText(
		'This link is incomplete. Ask the Storyteller for it again.'
	);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test("the players' Grim shows what the town knows, and each player's own guesses", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-19): "only publicly known information, such as who is alive, who is
	// dead, who has dead votes", and "players can tap a player and put what they think they are".
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seats = phone.getByTestId('grim-seat');
	await expect(seats).toHaveCount(8);
	await expect(seats.first()).toHaveAttribute('aria-label', 'Seat 1: Seat 1');
	// Drawn as the board is (plan J13), with the board's corner line for line (Trevor,
	// 2026-10-24): the join code, the night or day, and Game time.
	const corner = phone.getByTestId('player-grim').getByTestId('script-title');
	await expect(corner).toContainText('Trouble Brewing');
	await expect(corner.getByTestId('board-room-code')).toContainText(code.slice(3));
	// Game time ticks, so it is read as the board shows it, not to the second.
	await expect(page.getByTestId('board-game-clock')).toContainText('Game time');
	await expect(corner.getByTestId('board-game-clock')).toContainText('Game time');
	// The phone works out the players and the split by type itself, over the town (Trevor,
	// 2026-10-26: so players don't have to), whatever the board's corner shows.
	await expect(phone.getByTestId('grim-counts')).toHaveText(
		'Players: 8 (5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon)'
	);
	// Each corner line follows the Storyteller's eyes in Game info (Trevor, 2026-10-24).
	const info = await openGameInfo(page);
	await info.getByRole('button', { name: 'Author on the board' }).tap();
	await info.getByRole('button', { name: 'Players on the board' }).tap();
	await page.keyboard.press('Escape');
	await expect(info).toBeHidden();
	await expect(corner).not.toContainText('by The Pandemonium Institute');
	await expect(corner.getByTestId('board-players')).toContainText('Players: 8');
	// In a game the Script tab's Players section shows only the table's numbers, each in a
	// box, and no other count can be picked: the seats set it (Trevor, 2026-10-27).
	await phone.getByRole('tab', { name: 'Script' }).tap();
	await expect(phone.getByTestId('setup-table')).toHaveCount(0);
	const counts = phone.getByTestId('game-counts');
	for (const [type, n] of Object.entries({
		players: '8',
		townsfolk: '5',
		outsider: '1',
		minion: '1',
		demon: '1',
		traveller: '0'
	}))
		await expect(counts.getByTestId(`count-${type}`)).toHaveText(n);
	// A Fabled the Storyteller adds reaches the phones with its setup change (Trevor,
	// 2026-10-27; https://wiki.bloodontheclocktower.com/Sentinel).
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Add Fabled or Loric', exact: true })
		.tap();
	await page
		.getByRole('dialog', { name: 'Add Fabled or Loric' })
		.getByRole('button', { name: 'Sentinel', exact: true })
		.tap();
	await expect(counts.getByTestId('count-outsider')).toHaveText('0–2');
	await phone.getByRole('tab', { name: 'Grim' }).tap();

	// The Storyteller executes seat 1, and the ghost vote is spent in front of everyone.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: /^Status of/ })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await expect(seats.first()).toHaveAttribute(
		'aria-label',
		'Seat 1: Seat 1, dead, ghost vote not used'
	);
	await sheet.getByRole('button', { name: 'Ghost vote' }).tap();
	await expect(seats.first()).toHaveAttribute(
		'aria-label',
		'Seat 1: Seat 1, dead, ghost vote used'
	);
	await expect(seats.first().getByTestId('dead-mark')).toHaveAttribute('data-vote', 'used');

	// A guess is the player's own, on this phone only, and stays after a reload. The sheet
	// stays open, its guesses at the top, so a seat can take more than one.
	await seats.nth(1).tap();
	const seatTwo = phone.getByRole('dialog', { name: 'Seat 2 · Seat 2' });
	const yours = seatTwo.getByTestId('seat-guesses');
	await expect(yours).toHaveText(/None/);
	await seatTwo.getByRole('button', { name: 'Empath', exact: true }).tap();
	await expect(seats.nth(1)).toHaveAttribute('aria-label', 'Seat 2: Seat 2, your guess: Empath');
	await expect(seats.nth(1)).toHaveAttribute('data-guess', 'true');
	await expect(seats.nth(1).getByTestId('guess-marks')).toHaveCount(0);
	// Several roles for one seat (Trevor, 2026-10-25): the newest is the main one, on the face,
	// and the others are icons in a pill over the top-right rim.
	await seatTwo.getByRole('button', { name: 'Spy', exact: true }).tap();
	await expect(yours.getByRole('button')).toHaveCount(2);
	await expect(yours.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
	await expect(yours.getByRole('button').first()).toContainText('Spy');
	await phone.keyboard.press('Escape');
	await expect(seatTwo).toBeHidden();
	await expect(seats.nth(1)).toHaveAttribute(
		'aria-label',
		'Seat 2: Seat 2, your guess: Spy, Empath'
	);
	await expect(seats.nth(1).getByTestId('guess-mark')).toHaveCount(1);
	await expect(seats.nth(1).getByRole('img', { name: 'Empath' })).toBeVisible();
	// Tapping the pill makes the next guess the main one, without opening the sheet.
	await seats.nth(1).getByTestId('guess-marks').tap();
	await expect(seatTwo).toBeHidden();
	await expect(seats.nth(1)).toHaveAttribute(
		'aria-label',
		'Seat 2: Seat 2, your guess: Empath, Spy'
	);
	// In the sheet, tapping a guess makes it the main one, and tapping it in the list takes it off.
	await seats.nth(1).tap();
	await yours.getByRole('button', { name: /Spy/ }).tap();
	await expect(yours.getByRole('button').first()).toContainText('Spy');
	// The picker's Spy, after the chip of the same name.
	await seatTwo.getByRole('button', { name: 'Spy', exact: true }).last().tap();
	await expect(yours.getByRole('button')).toHaveCount(1);
	await phone.keyboard.press('Escape');
	await expect(seats.nth(1)).toHaveAttribute('aria-label', 'Seat 2: Seat 2, your guess: Empath');
	// Or only a type, or only good or evil (Trevor, 2026-10-24).
	await seats.nth(2).tap();
	const guessSheet = phone.getByRole('dialog', { name: 'Seat 3 · Seat 3' });
	await guessSheet.getByRole('button', { name: 'Minion', exact: true }).tap();
	await phone.keyboard.press('Escape');
	await expect(seats.nth(2)).toHaveAttribute('aria-label', 'Seat 3: Seat 3, your guess: Minion');
	await expect(seats.nth(2).getByRole('img', { name: 'Minion' })).toBeVisible();
	await seats.nth(3).tap();
	await phone
		.getByRole('dialog', { name: 'Seat 4 · Seat 4' })
		.getByRole('button', { name: 'Good', exact: true })
		.tap();
	await phone.keyboard.press('Escape');
	await expect(seats.nth(3)).toHaveAttribute('aria-label', 'Seat 4: Seat 4, your guess: Good');
	await phone.reload();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(seats.nth(1)).toHaveAttribute('aria-label', 'Seat 2: Seat 2, your guess: Empath');
	await expect(seats.nth(2)).toHaveAttribute('aria-label', 'Seat 3: Seat 3, your guess: Minion');
	await phoneContext.close();
});

test("a Traveller's seat on the players' Grim takes only Good or Evil", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-26): "Travelers cannot set guess for other characters, only alignment."
	// The town is told a Traveller's character (https://wiki.bloodontheclocktower.com/Travellers),
	// so a player marks only whether they think the Traveller is good or evil.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await page.getByRole('button', { name: /^Seat 2:/ }).tap();
	const st = page.locator('[data-scope="drawer"][data-part="content"]');
	await st.getByRole('button', { name: 'Choose character' }).first().tap();
	const pick = page.getByRole('dialog', { name: 'Character for Seat 2' });
	await pick.getByRole('searchbox').fill('Scapegoat');
	await pick.getByRole('button', { name: /^Scapegoat/ }).tap();
	// The Storyteller's own pick of its alignment stays theirs.
	await page
		.getByRole('dialog', { name: 'Alignment' })
		.getByRole('button', { name: 'Decide later' })
		.tap();
	await page.keyboard.press('Escape');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seat = phone.getByTestId('grim-seat').nth(1);
	await expect(seat).toHaveAttribute('aria-label', 'Seat 2: Seat 2, Traveller: Scapegoat');
	await seat.tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 2 · Seat 2' });
	// Good and Evil, and nothing else to guess.
	await expect(sheet.locator('[data-guess-key]')).toHaveCount(2);
	await expect(sheet.getByRole('button', { name: 'Minion', exact: true })).toHaveCount(0);
	await expect(sheet.getByRole('searchbox')).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Evil', exact: true }).tap();
	await expect(seat).toHaveAttribute(
		'aria-label',
		'Seat 2: Seat 2, Traveller: Scapegoat, your guess: Evil'
	);
	// The other alignment replaces it, and the same one again takes it off.
	await sheet.getByRole('button', { name: 'Good', exact: true }).last().tap();
	await expect(seat).toHaveAttribute(
		'aria-label',
		'Seat 2: Seat 2, Traveller: Scapegoat, your guess: Good'
	);
	await sheet.getByRole('button', { name: 'Good', exact: true }).last().tap();
	await expect(seat).toHaveAttribute('aria-label', 'Seat 2: Seat 2, Traveller: Scapegoat');
	await phone.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await phoneContext.close();
});

test("a player marks their own seat on the players' Grim, and it has a ring", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-26): "Allow marking a person as self in own grim", and "special glow or
	// effect on self in grim". A phone the room has not seated marks a seat as its own.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seat = phone.getByTestId('grim-seat').nth(2);
	await expect(phone.locator('[data-testid="grim-seat"][data-mine]')).toHaveCount(0);
	await seat.tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 3 · Seat 3' });
	const me = sheet.getByRole('checkbox', { name: 'This is me' });
	await expect(me).not.toBeChecked();
	await sheet.getByText('This is me', { exact: true }).tap();
	await expect(me).toBeChecked();
	await expect(seat).toHaveAttribute('data-mine');
	await expect(seat).toHaveAttribute('aria-label', 'Seat 3: Seat 3, you');
	await phone.keyboard.press('Escape');
	// A steady ring, with no pulse (Trevor, 2026-10-27).
	const disc = seat.locator('.disc');
	await expect(disc).toHaveCSS('outline-style', 'solid');
	await expect(disc).toHaveCSS('animation-name', 'none');
	await expect(disc).toHaveCSS('box-shadow', 'none');
	// Kept on this phone for the game.
	await phone.reload();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(seat).toHaveAttribute('data-mine');
	// One seat at a time, and it can be taken off.
	await phone.getByTestId('grim-seat').nth(4).tap();
	await phone
		.getByRole('dialog', { name: 'Seat 5 · Seat 5' })
		.getByText('This is me', { exact: true })
		.tap();
	await expect(phone.locator('[data-testid="grim-seat"][data-mine]')).toHaveCount(1);
	await expect(phone.getByTestId('grim-seat').nth(4)).toHaveAttribute('data-mine');
	await phone
		.getByRole('dialog', { name: 'Seat 5 · Seat 5' })
		.getByText('This is me', { exact: true })
		.tap();
	await expect(phone.locator('[data-testid="grim-seat"][data-mine]')).toHaveCount(0);
	await phoneContext.close();
});

test("a player's Grim fills the screen from its own corner, and a seat's sheet opens over it", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-27): "Allow players to also set their grim view to full screen, same thing
	// as town square ... with full screen in top right of town grim view".
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const town = phone.getByTestId('player-grim');
	const fullScreen = phone.getByRole('button', { name: 'Full screen', exact: true });
	// In the town's top right corner, as on Public Town.
	const box = (await town.boundingBox())!;
	const corner = (await fullScreen.boundingBox())!;
	expect(corner.x + corner.width).toBeGreaterThan(box.x + box.width * 0.85);
	expect(corner.y).toBeLessThan(box.y + box.height * 0.15);
	// A phone with a camera in the screen's top edge (Trevor's Pixel, 2026-10-27: "Unable to
	// close"): the app's status bar strip has height, and must not cover the corner.
	await phone.addStyleTag({ content: ':root { --app-top: 3rem; }' });
	await fullScreen.tap();
	await expect(fullScreen).toHaveAttribute('aria-pressed', 'true');
	const exit = (await fullScreen.boundingBox())!;
	expect(exit.y).toBeGreaterThanOrEqual(48);
	const onTop = await phone.evaluate(
		([x, y]) => !!document.elementFromPoint(x, y)?.closest('[aria-pressed="true"]'),
		[exit.x + exit.width / 2, exit.y + exit.height / 2]
	);
	expect(onTop).toBe(true);
	// Nor does the strip draw over the top of the part that fills the screen.
	const stripCovered = await phone.evaluate(
		() => !document.elementFromPoint(innerWidth / 2, 8)?.closest('[data-filled]')
	);
	expect(stripCovered).toBe(false);
	// The whole screen, under the camera too; only the text and controls step in, clear of the
	// camera and the rounded corners (Trevor, 2026-10-27: "moving out text and controls").
	const filled = (await town.boundingBox())!;
	const screen = phone.viewportSize()!;
	expect(Math.round(filled.x)).toBe(0);
	expect(Math.round(filled.y)).toBe(0);
	expect(Math.round(filled.width)).toBe(screen.width);
	expect(Math.round(filled.height)).toBe(screen.height);
	expect(screen.width - (exit.x + exit.width)).toBeGreaterThanOrEqual(12);
	const title = (await phone.getByTestId('script-title').boundingBox())!;
	expect(title.x).toBeGreaterThanOrEqual(12);
	expect(screen.height - (title.y + title.height)).toBeGreaterThanOrEqual(12);
	// A seat's sheet still opens over it.
	await phone.getByTestId('grim-seat').nth(2).tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 3 · Seat 3' });
	await expect(sheet.getByRole('checkbox', { name: 'This is me' })).toBeVisible();
	await phone.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	await expect(fullScreen).toHaveAttribute('aria-pressed', 'true');
	await fullScreen.tap();
	await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');
	await expect.poll(() => phone.evaluate(() => !!document.fullscreenElement)).toBe(false);
	expect(Math.round((await town.boundingBox())!.height)).toBeLessThan(screen.height);
	await phoneContext.close();
});

test('a player puts reminder tokens on seats in their own Grim', async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-26): "Reminder tokens for players to use". Any reminder of the script's
	// characters, since a player can't see which are in play; kept on the phone for the game.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	// A guess on another seat puts its character first (Trevor, 2026-10-26: "search and guess").
	await phone.getByTestId('grim-seat').nth(3).tap();
	await phone
		.getByRole('dialog', { name: 'Seat 4 · Seat 4' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await phone.keyboard.press('Escape');
	const seat = phone.getByTestId('grim-seat').nth(1);
	await seat.tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 2 · Seat 2' });
	await expect(sheet.getByTestId('seat-reminders')).toContainText('None');
	await sheet.getByTestId('seat-reminders').tap();
	const picker = phone.getByRole('dialog', { name: 'Reminders for Seat 2' });
	const list = picker.getByTestId('player-reminder-list');
	// The Storyteller's generic token on top, then the characters guessed.
	await expect(list.getByRole('group').first()).toHaveAccessibleName('Generic');
	await expect(list.locator('li.part').first()).toHaveText('Your guesses');
	await expect(list.getByRole('group').nth(1)).toHaveAccessibleName('Fortune Teller');
	// The search finds a token by its character's name or its own words.
	const search = picker.getByRole('searchbox', { name: 'Search reminders' });
	await expect(search).not.toBeFocused();
	await search.fill('poison');
	await expect(list.getByRole('group')).toHaveCount(1);
	await search.fill('');
	const poisoned = picker
		.getByRole('group', { name: 'Poisoner' })
		.getByRole('button', { name: 'Poisoned' });
	await expect(poisoned).toHaveAttribute('aria-pressed', 'false');
	await poisoned.tap();
	await expect(poisoned).toHaveAttribute('aria-pressed', 'true');
	await expect(
		picker.getByRole('group', { name: 'On this seat' }).getByRole('button', {
			name: 'Poisoned: take off'
		})
	).toBeVisible();
	await phone.keyboard.press('Escape');
	await expect(sheet.getByTestId('seat-reminders')).toContainText('Poisoned');
	await phone.keyboard.press('Escape');
	await expect(seat).toHaveAttribute('aria-label', 'Seat 2: Seat 2, your reminders: Poisoned');
	const token = phone.getByTestId('player-grim').getByTestId('board-reminder');
	await expect(token).toHaveCount(1);
	await expect(token).toHaveAccessibleName('Poisoned reminder');

	// Kept on this phone for the game.
	await phone.reload();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(token).toHaveCount(1);
	// A tap on the token opens the seat's reminders, where it comes off.
	await token.tap();
	await phone
		.getByRole('dialog', { name: 'Reminders for Seat 2' })
		.getByRole('button', { name: 'Poisoned: take off' })
		.tap();
	await expect(token).toHaveCount(0);
	await phoneContext.close();
});

test("a player puts generic tokens with numbers or notes on their own Grim's seats", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-26): "Give them access to the generic token reminders for those 1/2/3
	// custom note ones". The Storyteller's ∞ token, as many as wanted, each with its own text.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await phone.getByTestId('grim-seat').nth(2).tap();
	await phone.getByTestId('seat-reminders').tap();
	const picker = phone.getByRole('dialog', { name: 'Reminders for Seat 3' });
	const add = picker.getByRole('button', { name: 'Add a generic token' });
	const text = phone.getByTestId('reminder-note');
	for (const words of ['1', '2']) {
		await add.tap();
		await text.fill(words);
		await text.press('Enter');
		await phone.keyboard.press('Escape');
		await expect(text).toBeHidden();
	}
	const here = picker.getByRole('group', { name: 'On this seat' }).getByRole('button');
	await expect(here).toHaveText(['1', '2']);
	// A placed one opens its look again, where it can be deleted.
	await here.first().tap();
	await phone.getByRole('button', { name: 'Delete token' }).tap();
	await expect(here).toHaveText(['2']);
	await phone.keyboard.press('Escape');
	await phone.keyboard.press('Escape');
	const placed = phone.getByTestId('player-grim').getByTestId('board-reminder');
	await expect(placed).toHaveAccessibleName('Generic reminder: 2');
	// Kept on this phone for the game.
	await phone.reload();
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(placed).toHaveAccessibleName('Generic reminder: 2');
	await phoneContext.close();
});

test("a seat's other guesses stay on the screen, on whichever side of the Grim it sits", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-27): "Guesses run off side of screen". A pill of other guesses sits on
	// the rim toward the middle of the grim, so a seat at the screen's edge keeps it in view.
	// Thirteen seats, as in Trevor's game, puts seats against both edges of a phone.
	// Three guesses on each of thirteen seats takes a while.
	test.slow();
	const board = await startGame(page, undefined, 13);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seats = phone.getByTestId('grim-seat');
	const count = await seats.count();
	for (let i = 0; i < count; i++) {
		await seats.nth(i).tap();
		const sheet = phone.getByRole('dialog', { name: `Seat ${i + 1} · Seat ${i + 1}` });
		await sheet.getByRole('button', { name: 'Empath', exact: true }).tap();
		await sheet.getByRole('button', { name: 'Spy', exact: true }).tap();
		await sheet.getByRole('button', { name: 'Imp', exact: true }).tap();
		await phone.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
	}
	const width = phone.viewportSize()!.width;
	for (let i = 0; i < count; i++) {
		const pill = seats.nth(i).getByTestId('guess-marks');
		await expect(pill).toBeVisible();
		const box = (await pill.boundingBox())!;
		expect(box.x, `Seat ${i + 1}'s pill`).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width, `Seat ${i + 1}'s pill`).toBeLessThanOrEqual(width);
	}
	await phoneContext.close();
});

test("a Banshee the Demon killed shows two votes and no ghost vote on the players' Grim", async ({
	page,
	browser
}, testInfo) => {
	// Everyone learns when the Demon kills the Banshee, who then votes twice on each nomination
	// with no ghost vote to spend (https://wiki.bloodontheclocktower.com/Banshee); the players'
	// grim says so as the board does.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seat = phone.getByTestId('grim-seat').first();
	await expect(seat).toHaveAttribute('aria-label', 'Seat 1: Seat 1');

	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await picker.getByText('Include characters not on the script').tap();
	await picker.getByRole('button', { name: 'Banshee', exact: true }).tap();
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 1' })
		.getByRole('button', { name: 'The Demon' })
		.tap();
	await expect(seat).toHaveAttribute('aria-label', 'Seat 1: Seat 1, dead, 2 votes per nomination');
	// The skull, as on the board: no ghost to spend.
	await expect(seat.getByTestId('dead-mark')).not.toHaveAttribute('data-vote');

	// Executed instead, the Banshee is just dead, with a ghost vote like anyone.
	await sheet.getByRole('button', { name: /^Status:/ }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 1' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await expect(seat).toHaveAttribute('aria-label', 'Seat 1: Seat 1, dead, ghost vote not used');
	await phoneContext.close();
});

test('a player writes notes on a seat from the Grim tab, and the Notes tab lists them', async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-24): "allow players to write notes directly from the grim screen relating
	// to players", which "show up in the notes area", as the Storyteller's per-player notes do.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const seats = phone.getByTestId('grim-seat');
	await expect(seats).toHaveCount(8);

	await seats.nth(2).tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 3 · Seat 3' });
	await expect(sheet.getByTestId('seat-note')).toContainText('None');
	await sheet.getByTestId('seat-note').tap();
	// Several titled notes per player, as the game's notes (Trevor, 2026-10-26).
	const notes = phone.getByRole('dialog', { name: 'Notes: Seat 3' });
	const cards = notes.locator('[data-note]');
	const editor = phone.getByRole('dialog', { name: 'Note', exact: true });
	await expect(cards).toHaveCount(0);
	await notes.getByTestId('new-note').tap();
	await editor.getByRole('textbox', { name: 'Title' }).fill('Claim');
	await editor.getByRole('textbox', { name: 'Text' }).fill('Claims Chef: 1');
	// Kept as it closes, with no Save.
	await editor.getByRole('button', { name: 'Close' }).tap();
	await expect(cards).toHaveText(/^\s*Claim\s*Claims Chef: 1\s*$/);
	await notes.getByTestId('new-note').tap();
	await editor.getByRole('textbox', { name: 'Text' }).fill('Quiet all day');
	await editor.getByRole('button', { name: 'Close' }).tap();
	await expect(cards).toHaveText([/Claim/, /Quiet all day/]);
	await notes.getByRole('button', { name: 'Close' }).tap();
	// The seat's sheet lists them on one line.
	await expect(sheet.getByTestId('seat-note')).toContainText('Claim, Quiet all day');
	// Guessed as two characters, both listed after the name on the Notes tab.
	await sheet.getByRole('button', { name: 'Empath', exact: true }).tap();
	await sheet.getByRole('button', { name: 'Spy', exact: true }).tap();
	await phone.keyboard.press('Escape');
	await expect(seats.nth(2).getByTestId('note-mark')).toBeVisible();
	await expect(seats.nth(2)).toHaveAttribute(
		'aria-label',
		'Seat 3: Seat 3, your guess: Spy, Empath, your note'
	);
	// The board's own note mark, which opens the notes straight away, as on the board (Trevor,
	// 2026-10-25: the same icon and the same behaviour).
	await seats.nth(2).getByTestId('note-mark').tap();
	await expect(cards).toHaveText([/Claim/, /Quiet all day/]);
	await expect(sheet).toHaveCount(0);
	await notes.getByRole('button', { name: 'Close' }).tap();

	// The Notes tab lists every seat with its notes, and opens the same editor.
	await phone.getByRole('tab', { name: 'Notes' }).tap();
	await expect(phone.getByRole('heading', { name: 'Players' })).toBeVisible();
	const row = phone.locator('[data-seat-note]').nth(2);
	await expect(row.locator('[data-note]')).toHaveText([/Claim/, /Quiet all day/]);
	// The player's name leads, as the one thing about a seat that never changes, then every
	// character the seat is guessed as, all alike (Trevor, 2026-10-27).
	await expect(row.getByTestId('player-badge')).toHaveText('Seat 3');
	await expect(row.getByTestId('note-guesses').locator('.badge')).toHaveText(['Spy', 'Empath']);
	await expect(phone.locator('[data-seat-note]').first().locator('[data-note]')).toHaveCount(0);
	await row.locator('[data-note]').first().tap();
	await editor.getByRole('textbox', { name: 'Text' }).fill('Claims Chef: 0');
	await editor.getByRole('button', { name: 'Close' }).tap();
	await expect(row.locator('[data-note]').first()).toContainText('Claims Chef: 0');
	await row.getByTestId('new-note').tap();
	await editor.getByRole('textbox', { name: 'Text' }).fill('Voted for Ana');
	await editor.getByRole('button', { name: 'Close' }).tap();
	await expect(row.locator('[data-note]')).toHaveCount(3);
	// On this phone only, and kept after a reload.
	await phone.reload();
	await phone.getByRole('tab', { name: 'Notes' }).tap();
	await expect(phone.locator('[data-seat-note]').nth(2).locator('[data-note]')).toHaveText([
		/Claims Chef: 0/,
		/Quiet all day/,
		/Voted for Ana/
	]);
	// Closed, the header counts the notes written on players, not the seats (Trevor, 2026-10-27).
	const players = phone.getByRole('button', { name: 'Players' });
	await players.tap();
	await expect(players.getByTestId('section-count')).toHaveText('3');
	await players.tap();
	await phoneContext.close();
});

test("on a laptop the player's screen shows the script's logo, and the guess sheet scrolls", async ({
	page,
	browser
}, testInfo) => {
	test.skip(testInfo.project.name !== 'tablet', 'A laptop window, once');
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	// A laptop: a mouse or trackpad and a wide window.
	const laptop = await browser.newContext({ viewport: { width: 1366, height: 600 } });
	const phone = await laptop.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	// The script's logo before its name (Trevor, 2026-10-23).
	await expect(phone.getByRole('heading', { level: 1 }).getByTestId('script-logo')).toHaveAttribute(
		'data-logo',
		/.+/
	);

	// A trackpad's two-finger scroll moves the guess sheet's characters (Trevor, 2026-10-23).
	await phone.getByRole('tab', { name: 'Grim' }).click();
	await phone.getByTestId('grim-seat').nth(1).click();
	const sheet = phone.getByRole('dialog', { name: 'Seat 2 · Seat 2' });
	const empath = sheet.getByRole('button', { name: 'Empath', exact: true });
	await expect(empath).toBeVisible();
	// The sheet scrolls under a wheel or trackpad. Newer Chrome stopped the scroll at the
	// character list, which had nothing to scroll but kept scrolls to itself (2026-10-23).
	const scrolled = () =>
		empath.evaluate((el) => {
			let b = el.parentElement;
			while (
				b &&
				!(b.scrollHeight > b.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(b).overflowY))
			)
				b = b.parentElement;
			return b ? { top: b.scrollTop, max: b.scrollHeight - b.clientHeight } : undefined;
		});
	const start = (await scrolled())!;
	expect(start).toEqual({ top: 0, max: expect.any(Number) });
	expect(start.max).toBeGreaterThan(0);
	// From the foot of the screen, over the character list, which runs on below it (the rows
	// above the list can push Empath itself out of view).
	// The lowest point near the foot that is over one of the list's buttons, whatever rows sit
	// above the list.
	const at = (await empath.boundingBox())!;
	const height = phone.viewportSize()!.height;
	let foot = 0;
	await expect
		.poll(async () => {
			foot = await phone.evaluate(
				([x, h]) => {
					for (let y = h * 0.95; y > h * 0.7; y -= 4)
						if (document.elementFromPoint(x, y)?.closest('[role="dialog"] button')) return y;
					return 0;
				},
				[at.x + at.width / 2, height]
			);
			return foot > 0;
		})
		.toBe(true);
	await phone.mouse.move(at.x + at.width / 2, foot);
	await phone.mouse.wheel(0, start.max + 200);
	await expect.poll(async () => (await scrolled())!.top).toBeGreaterThanOrEqual(start.max - 1);
	await laptop.close();
});

test("a player's initials and frame go on their seat, and their avatar is in the cycle of guesses", async ({
	page,
	browser
}, testInfo) => {
	// Plan R6 (Trevor, 2026-10-22: "avatar is default"; 2026-10-23: "Initials for now") and L4
	// (players pick their frame with their avatar).
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	const you = await seatSheet(phone);
	// Initials are always on, with no switch (Trevor, 2026-10-25).
	await expect(you.getByText('Initials on your seat', { exact: true })).toHaveCount(0);
	await setPlayerName(phone, 'Alex Kim');
	await phone.keyboard.press('Escape');
	await expect(page.getByRole('list', { name: 'Players in the room' })).toContainText('Alex Kim');
	await nameSeat(page, 3, 'Alex Kim');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '3');
	await expect(phone.getByRole('button', { name: 'Your settings: Alex Kim' })).toBeVisible();

	// On the board: the seat has no character yet, so the initials are its face.
	const seat = page.locator('[data-testid="seat"][aria-label^="Seat 3: Alex Kim"]');
	await expect(seat.getByTestId('avatar-face')).toHaveText('AK');

	// The frame (picked in Settings > Player, e2e/frames.e2e.ts) goes when the phone connects.
	await phone.evaluate(() => {
		const key = 'grim-games:player-settings:v1';
		const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
		localStorage.setItem(key, JSON.stringify({ ...settings, frame: 'clock' }));
	});
	await phone.reload();
	await expect(seat.locator('svg[data-frame="clock"]')).toBeAttached();
	await expect(seat.getByTestId('avatar-face')).toHaveText('AK');

	// Every phone at the table sees it. A guess goes on the token, and the avatar joins the
	// guesses' cycle, so the pill brings it back (Trevor, 2026-10-26).
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	const mine = phone.getByTestId('grim-seat').nth(2);
	await expect(mine.getByTestId('avatar-face')).toHaveText('AK');
	await mine.tap();
	const sheet = phone.getByRole('dialog', { name: 'Seat 3 · Alex Kim' });
	// The player's avatar, left of the seat's name (Trevor, 2026-10-27).
	await expect(sheet.getByTestId('sheet-avatar')).toHaveText('AK');
	const avatarBox = (await sheet.getByTestId('sheet-avatar').boundingBox())!;
	const titleBox = (await sheet.getByText('Seat 3 · Alex Kim', { exact: true }).boundingBox())!;
	expect(avatarBox.x + avatarBox.width).toBeLessThanOrEqual(titleBox.x);
	const empath = sheet.getByRole('button', { name: 'Empath', exact: true });
	await empath.scrollIntoViewIfNeeded();
	await expect(empath).toBeInViewport();
	await empath.tap();
	// The sheet's cycle: the guess in front, then the avatar.
	const cycle = sheet.getByTestId('seat-guesses').getByRole('button');
	await expect(cycle).toHaveCount(2);
	await expect(cycle.first()).toContainText('Empath');
	await expect(cycle.last()).toHaveAccessibleName('Avatar');
	await phone.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(mine).toHaveAttribute('aria-label', /your guess: Empath/);
	await expect(mine).toHaveAttribute('data-guess', 'true');
	const pill = mine.getByTestId('guess-marks');
	await expect(pill.getByRole('img', { name: 'Avatar' })).toBeVisible();
	await pill.tap();
	await expect(sheet).toBeHidden();
	await expect(mine).not.toHaveAttribute('data-guess', 'true');
	await expect(pill.getByRole('img', { name: 'Empath' })).toBeVisible();
	await expect(mine.getByTestId('avatar-face')).toHaveText('AK');
	// Still the player's guess, behind the avatar.
	await expect(mine).toHaveAttribute('aria-label', /your guess: Empath/);
	await pill.tap();
	await expect(mine).toHaveAttribute('data-guess', 'true');
	await phoneContext.close();
});

/** A small wide PNG, red on the left and blue on the right, as a picture from a phone. */
const PICTURE = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAIAAAB/FOjAAAAAF0lEQVR4nGP4z8CAFeEQ/o9LeFQDRRoApTd/gRs1jBkAAAAASUVORK5CYII=',
	'base64'
);

test("a player's own picture goes on their seat, and a report lets the Storyteller remove it for the game", async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-10-27: "allow setting users profile/icon in the player settings ... under ...,
	// put report image ... the storyteller ... can either decide to let it stand, or to
	// remove/revoke avatar for that game".
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	// Alex picks a picture in the player screen's own settings, beside their name.
	const alexContext = await browser.newContext({ ...testInfo.project.use });
	const alex = await alexContext.newPage();
	await alex.goto(`/join/${code}`);
	const you = await seatSheet(alex);
	const picture = you.getByTestId('avatar-picture');
	await expect(picture.getByRole('button', { name: 'Remove picture' })).toBeDisabled();
	// "+ Image" (Trevor, 2026-10-27), the add icon and one word.
	await expect(picture.getByRole('button', { name: 'Image', exact: true })).toBeVisible();
	await picture.getByLabel('Picture for your seat').setInputFiles({
		name: 'me.png',
		mimeType: 'image/png',
		buffer: PICTURE
	});
	// The crop screen (Trevor, 2026-10-27: "identify the exact contours of the picture"): the
	// middle first; a drag to the right shows its left, and Save keeps that part.
	const crop = alex.getByRole('dialog', { name: 'Your picture' });
	const area = crop.getByTestId('avatar-crop');
	const shown = area.locator('img');
	await expect(shown).toHaveAttribute('style', /left: -50%/);
	const box = (await area.boundingBox())!;
	const y = box.y + box.height / 2;
	await area.dispatchEvent('pointerdown', { pointerId: 1, clientX: box.x + 10, clientY: y });
	await area.dispatchEvent('pointermove', {
		pointerId: 1,
		clientX: box.x + box.width,
		clientY: y
	});
	await area.dispatchEvent('pointerup', { pointerId: 1, clientX: box.x + box.width, clientY: y });
	await expect(shown).toHaveAttribute('style', /left: 0%/);
	await crop.getByRole('button', { name: 'Save' }).tap();
	await expect(crop).toBeHidden();
	await expect(picture.getByTestId('avatar-face')).toHaveAttribute('data-picture', 'true');
	await expect(picture.getByRole('button', { name: 'Remove picture' })).toBeEnabled();
	// Only the left half, red, was kept.
	const kept = await picture
		.getByTestId('avatar-face')
		.locator('img')
		.evaluate((img) => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			const context = canvas.getContext('2d')!;
			const image = img as HTMLImageElement;
			context.drawImage(image, image.naturalWidth - 1, 0, 1, 1, 0, 0, 1, 1);
			return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
		});
	expect(kept[0]).toBeGreaterThan(200);
	expect(kept[2]).toBeLessThan(60);
	// A tap on the picture opens the crop screen again on the whole picture, where it was left
	// (Trevor, 2026-10-27: "clicking on picture in player settings to preview and edit crop").
	await picture.getByRole('button', { name: 'Move or zoom your picture' }).tap();
	await expect(crop).toBeVisible();
	await expect(shown).toHaveAttribute('style', /left: 0%/);
	await expect(shown).toHaveAttribute('style', /width: 200%/);
	await crop.getByRole('button', { name: 'Cancel' }).tap();
	await expect(crop).toBeHidden();
	await setPlayerName(alex, 'Alex Kim');
	await alex.keyboard.press('Escape');
	await expect(page.getByRole('list', { name: 'Players in the room' })).toContainText('Alex Kim');
	await nameSeat(page, 3, 'Alex Kim');

	// The board and every phone show it in place of the initials.
	const seat = page.locator('[data-testid="seat"][aria-label^="Seat 3: Alex Kim"]');
	await expect(seat.getByTestId('avatar-face')).toHaveAttribute('data-picture', 'true');
	await expect(seat.getByTestId('avatar-face').locator('img')).toBeVisible();

	const samContext = await browser.newContext({ ...testInfo.project.use });
	const sam = await samContext.newPage();
	await sam.goto(`/join/${code}`);
	await sam.getByRole('tab', { name: 'Grim' }).tap();
	const alexSeat = sam.getByTestId('grim-seat').nth(2);
	await expect(alexSeat.getByTestId('avatar-face')).toHaveAttribute('data-picture', 'true');

	// A seat with no picture has nothing to report; Alex's has.
	await sam.getByTestId('grim-seat').first().tap();
	let sheet = sam.getByRole('dialog', { name: 'Seat 1 · Seat 1' });
	await sheet.getByRole('button', { name: 'More for this seat' }).tap();
	await expect(sam.getByRole('menuitem', { name: 'Report picture' })).toBeDisabled();
	await sam.keyboard.press('Escape');
	await sam.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await alexSeat.tap();
	sheet = sam.getByRole('dialog', { name: 'Seat 3 · Alex Kim' });
	await sheet.getByRole('button', { name: 'More for this seat' }).tap();
	await sam.getByRole('menuitem', { name: 'Report picture' }).tap();
	await sheet.getByRole('button', { name: 'More for this seat' }).tap();
	await expect(sam.getByRole('menuitem', { name: 'Picture reported' })).toBeDisabled();
	await sam.keyboard.press('Escape');

	// The Storyteller sees the picture over the board, and removes it for this game.
	const report = page.getByRole('dialog', { name: 'Reported picture' });
	await expect(report).toContainText("Alex Kim's picture was reported by 1 player.");
	await expect(report.getByRole('img', { name: "Alex Kim's picture" })).toBeVisible();
	await report.getByRole('button', { name: 'Remove for this game' }).tap();
	await expect(report).toBeHidden();
	await expect(seat.getByTestId('avatar-face')).toHaveText('AK');
	await expect(seat.getByTestId('avatar-face')).not.toHaveAttribute('data-picture');
	await expect(alexSeat.getByTestId('avatar-face')).toHaveText('AK');

	// Alex keeps the picture on their phone; the room keeps it off their seat this game.
	await alex.reload();
	await expect(alex.getByTestId('you-row')).toHaveAttribute('data-seat', '3');
	await expect(seat.getByTestId('avatar-face')).toHaveText('AK');
	await alexContext.close();
	await samContext.close();
});

test("Scan a code on Join game reads the Share screen's QR code into the code boxes", async ({
	page,
	browser
}, testInfo) => {
	// Plan J2 (2026-10-22): "on join room, allow an option to scan a code". In the app, since
	// an iPhone's camera app opens the link in Safari rather than the installed app.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const qr = page.getByRole('img', { name: 'QR code to join the room' });
	const png = await qr.screenshot({ animations: 'disabled' });

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await aimCamera(phone, `data:image/png;base64,${png.toString('base64')}`);
	await phone.goto('/join');
	await phone.getByRole('button', { name: 'Scan a code' }).tap();
	await expect(phone.getByRole('dialog', { name: 'Scan a code' })).toBeVisible();
	// The code fills the boxes and shows its game, so the phone still picks Join as player or
	// ⋯ > Public Town (Trevor, 2026-10-26: one QR for both).
	await expect(phone.getByTestId('room-preview')).toContainText('Trouble Brewing', {
		timeout: 15_000
	});
	await expect(phone.getByRole('dialog', { name: 'Scan a code' })).toBeHidden();
	await expect(phone.getByRole('textbox', { name: 'Room code from the Storyteller' })).toHaveValue(
		code
	);
	await phone.getByRole('button', { name: 'Join as player' }).tap();
	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await phoneContext.close();
});

test('Scan a code says so when the code is not a room', async ({ browser }, testInfo) => {
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	// A link that is neither a room nor a script (a script's opens it: offline-share.e2e.ts).
	await aimCamera(phone, qrSrc(renderSVG('https://example.com/menu', { border: 2 })));
	await phone.goto('/join');
	await phone.getByRole('button', { name: 'Scan a code' }).tap();
	const scanner = phone.getByRole('dialog', { name: 'Scan a code' });
	await expect(scanner.getByRole('alert')).toHaveText(
		"That code is not a game's room code or a script.",
		{
			timeout: 15_000
		}
	);
	await expect(phone).toHaveURL(/\/join$/);
	await scanner.getByRole('button', { name: 'Close' }).tap();
	await expect(scanner).toBeHidden();
	await phoneContext.close();
});

test("Share on a player's Grim tab blurs the guesses behind it", async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-26, playtest): with Share open on a phone, the players around it could
	// read its guesses on the Grim behind it.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await phone.getByRole('tab', { name: 'Grim' }).tap();
	await expect(phone.getByTestId('grim-seat')).toHaveCount(8);
	await phone.getByRole('button', { name: 'Share script' }).tap();
	await expect(phone.getByRole('dialog', { name: 'Share', exact: true })).toBeVisible();
	const filter = await phone
		.locator("[data-scope='dialog'][data-part='backdrop']")
		.last()
		.evaluate((el) => getComputedStyle(el).backdropFilter);
	expect(filter).toContain('blur');
	await phoneContext.close();

	// The board's Script dialog shows the same Grim tab; closing it leaves the board blurred
	// behind its own sheets.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	await page.getByRole('tab', { name: 'Grim' }).tap();
	await page.keyboard.press('Escape');
	await expect(page.locator(':root')).toHaveAttribute('data-board-shown', '');
});
