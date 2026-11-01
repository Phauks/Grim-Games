import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';

// Remove from room (plan J37; Trevor, 2026-10-29: "removed from room, on storyteller phone, it
// shows the kicked menu. only good for that game, but the kick can be revoked").

async function openRoom(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.goto(`${new URL(page.url()).pathname}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	return (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
}

async function joinAs(browser: Browser, testInfo: TestInfo, code: string, name: string) {
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, name);
	await phone.keyboard.press('Escape');
	return phone;
}

/** Names a seat on the board, which seats the phone with that name. */
async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

/** Types a room code on Join game, which looks the game up as the code is typed. */
async function typeCode(phone: Page, code: string) {
	await phone.goto('/join');
	const field = phone.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
}

// Trevor, 2026-10-31: the kicked phone kept the game open with the room code at the top; it
// should be kicked out of the game, told so as it types the code again, and Unblock only lets
// it try again, with no seat back.
test('a removed phone leaves the game, is turned away at the code, and Unblock seats it nowhere', async ({
	page,
	browser
}, testInfo) => {
	const code = await openRoom(page);
	const board = page.url().replace(/\/room$/, '');
	await page.goto(board);
	await nameSeat(page, 1, 'Ana');
	await page.goto(`${board}/players`);
	const players = page.getByRole('list', { name: 'Players in the room' }).getByRole('listitem');
	const unseated = players.filter({ hasText: 'No seat' });
	const removed = page.getByTestId('room-removed');
	// Hidden until someone is blocked (Trevor, 2026-10-31).
	await expect(removed).toHaveCount(0);
	const phone = await joinAs(browser, testInfo, code, 'Ana');
	// Seated by name in seat 1, and in the game: the script's tabs show.
	const ana = players.filter({ hasText: 'Ana' });
	await expect(ana).toHaveCount(1);
	await expect(unseated).toHaveCount(0);
	await expect(phone.getByRole('tab', { name: 'Grim' })).toBeVisible();

	// The red trash on the chosen player asks first.
	await ana.getByRole('button').tap();
	await page.getByTestId('room-player-sheet').getByTestId('room-player-remove').tap();
	await page
		.getByRole('alertdialog', { name: 'Block this player from the room?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(removed.getByTestId('room-removed-player')).toHaveText([/Ana/]);
	// Their seat lost the name, so nothing seats them there again by name.
	await expect(players.filter({ hasText: 'Ana' })).toHaveCount(0);

	// The phone is out of the game: told why, with no script or tabs left open.
	await expect(phone.getByRole('alert')).toHaveText('The Storyteller removed you from this game.');
	await expect(phone.getByRole('tab', { name: 'Grim' })).toHaveCount(0);
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toHaveCount(0);

	// Typing the code again is turned away there, before the room opens.
	await typeCode(phone, code);
	const preview = phone.getByTestId('room-preview');
	await expect(preview).toContainText('The Storyteller removed you from this game.');
	await expect(phone.getByRole('button', { name: 'Join as player' })).toBeDisabled();

	// Unblock only lets the phone try again: it joins as a new phone, with no seat.
	await removed.getByRole('button', { name: 'Unblock' }).tap();
	await expect(removed).toHaveCount(0);
	await typeCode(phone, code);
	await expect(preview).toContainText('Trouble Brewing');
	await phone.getByRole('button', { name: 'Join as player' }).tap();
	await expect(unseated).toHaveText([/Ana\s*No seat/]);
	await phone.context().close();
});

test('a phone removed while on its player screen lands on the join screen, out of the game', async ({
	page,
	browser
}, testInfo) => {
	const code = await openRoom(page);
	await page.goto(page.url().replace(/\/room$/, '/players'));
	const unseated = page
		.getByRole('list', { name: 'Players in the room' })
		.getByRole('listitem')
		.filter({ hasText: 'No seat' });
	const phone = await joinAs(browser, testInfo, code, 'Ana');
	await expect(unseated).toHaveText([/Ana\s*No seat/]);
	// The player screen follows the room this phone last joined.
	await phone.goto('/play');
	await expect(phone.getByRole('tab', { name: 'Grim' })).toBeVisible();

	await unseated.getByRole('button').tap();
	await page.getByTestId('room-player-sheet').getByTestId('room-player-remove').tap();
	await page
		.getByRole('alertdialog', { name: 'Block this player from the room?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();

	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	await expect(phone.getByRole('alert')).toHaveText('The Storyteller removed you from this game.');
	await expect(phone.getByRole('tab', { name: 'Grim' })).toHaveCount(0);
	await phone.context().close();
});
