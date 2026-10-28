import { expect, test, type Page } from '@playwright/test';
import { nameStoryteller, toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';

// Room transfer (Trevor, 2026-10-28): "Storyteller A can transfer the rights of hosting the
// room to storyteller B so that people don't have to rejoin". The Storyteller's Share screen
// shows an eight-digit transfer code ("8 digits, not 6, so it looks different from a room
// code"); the other device types the room code on Join game, then ⋯ > Room transfer and the
// code, and the Storyteller's device allows it ("so that someone cannot just take the room
// without consent"). The old device is then put out of the room ("force the user out").

async function startGame(page: Page): Promise<{ board: string; code: string }> {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await nameStoryteller(page, 'Trevor');
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	return { board, code };
}

/** Opens Room transfer on the Storyteller's Share screen and reads its code. */
async function openTransfer(page: Page): Promise<string> {
	await page.getByRole('button', { name: 'Room transfer' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Room transfer' });
	await expect(dialog.getByTestId('transfer-code')).toHaveText(/^\d{4} \d{4}$/);
	await expect(dialog.getByTestId('transfer-time')).toHaveText(/^Expires in [45]:\d\d$/);
	return (await dialog.getByTestId('transfer-code').textContent())!.replace(/\s/g, '');
}

/** On Join game, types the room code and opens ⋯ > Room transfer. */
async function claim(other: Page, code: string) {
	await other.goto('/join');
	const field = other.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
	await expect(other.getByTestId('room-preview')).toContainText('Trouble Brewing');
	await other.getByRole('button', { name: 'More ways to join' }).tap();
	await other.getByRole('menuitem', { name: 'Room transfer' }).tap();
	return other.getByRole('dialog', { name: 'Room transfer' });
}

async function typeTransferCode(other: Page, code: string) {
	// A code already there is cleared with the X first, as on any code field (typing carries
	// on from the last box), then the new one goes in whole, as a pasted code does.
	const form = other.getByTestId('transfer-claim');
	const field = form.getByRole('textbox', { name: 'Transfer code' });
	if (await field.inputValue()) await form.getByRole('button', { name: 'Clear' }).tap();
	await expect(field).toHaveValue('');
	await field.fill(code);
}

test('a Storyteller hands the room and the game to another device, and the players stay', async ({
	page,
	browser
}, testInfo) => {
	const { board, code } = await startGame(page);
	const gameId = board.split('/').pop();

	// A player joins and is seated.
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	const players = page.getByRole('list', { name: 'Players in the room' }).getByRole('listitem');
	await expect(players).toHaveText(/^Alex\s*No seat$/);
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Alex');
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '1');

	// The Storyteller opens Room transfer and brings the game.
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const transferCode = await openTransfer(page);
	const dialog = page.getByRole('dialog', { name: 'Room transfer' });
	await dialog.getByText('Bring this game', { exact: true }).tap();
	await expect(dialog.getByRole('checkbox', { name: 'Keep storytelling' })).toBeDisabled();
	await expect(dialog.getByRole('checkbox', { name: 'Join as a player' })).toBeChecked();

	// The other Storyteller's device: a wrong code says so, the right one says what comes.
	const otherContext = await browser.newContext({ ...testInfo.project.use });
	// The new Storyteller's Profile name, which the old device is asked about.
	await otherContext.addInitScript(() =>
		localStorage.setItem('grim-games-room-name', JSON.stringify('Pat'))
	);
	const other = await otherContext.newPage();
	const take = await claim(other, code);
	const wrong = transferCode === '00000000' ? '11111111' : '00000000';
	await typeTransferCode(other, wrong);
	await expect(take.getByTestId('transfer-status')).toHaveText('Wrong code: 2 tries left');
	await expect(take.getByRole('button', { name: 'Take over' })).toBeDisabled();
	await typeTransferCode(other, transferCode);
	await expect(take.getByTestId('transfer-status')).toContainText('Trevor');
	await expect(take.getByTestId('transfer-status')).toContainText('1 player and the game');
	await take.getByRole('button', { name: 'Take over' }).tap();
	await expect(take.getByTestId('transfer-status')).toHaveText(
		'Waiting for the Storyteller to allow it.'
	);

	// Nothing changes hands until the Storyteller's device allows it.
	const ask = page.getByRole('alertdialog', { name: 'Room transfer' });
	await expect(ask).toContainText('Pat wants to take over this room as its Storyteller.');
	await ask.getByRole('button', { name: 'Confirm' }).tap();

	// The game opens on the new device, with the same seats; the old one is put out of the
	// room and joins it as a player.
	await expect(other).toHaveURL(new RegExp(`/grimoire/${gameId}$`));
	await expect(other.locator('[data-testid="seat"][aria-label^="Seat 1: Alex"]')).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/join/${code}$`));

	// The players never rejoined: the new Storyteller's room lists Alex in seat 1.
	await other.goto(`/grimoire/${gameId}/room`);
	await expect(other.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(other.getByTestId('share-code')).toHaveText(`${code.slice(0, 3)} ${code.slice(3)}`);
	await expect(
		other.getByRole('list', { name: 'Players in the room' }).getByRole('listitem')
	).toContainText(['Alex']);
	await expect(phone.getByTestId('you-row')).toHaveAttribute('data-seat', '1');
	await phoneContext.close();
	await otherContext.close();
});

test('a stopped room transfer turns its code away, and a new game goes without the game', async ({
	page,
	browser
}, testInfo) => {
	const { code } = await startGame(page);
	const first = await openTransfer(page);
	const dialog = page.getByRole('dialog', { name: 'Room transfer' });
	await dialog.getByText('Join as a player', { exact: true }).tap();
	await dialog.getByRole('button', { name: 'Stop transfer' }).tap();
	await expect(dialog).toBeHidden();

	const otherContext = await browser.newContext({ ...testInfo.project.use });
	const other = await otherContext.newPage();
	const take = await claim(other, code);
	await typeTransferCode(other, first);
	await expect(take.getByTestId('transfer-status')).toHaveText('This room has no transfer open.');

	// A new transfer, without the game: the new device starts a New game in the same room.
	const second = await openTransfer(page);
	await typeTransferCode(other, second);
	await expect(take.getByTestId('transfer-status')).toContainText('and a new game');

	// Turned down: the other device is told, and can ask again with the same code.
	await take.getByRole('button', { name: 'Take over' }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Room transfer' });
	await expect(ask).toContainText('Another device wants to take over this room');
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(ask).toBeHidden();
	await expect(take.getByTestId('transfer-status')).toHaveText('The Storyteller turned it down.');
	await take.getByRole('button', { name: 'Take over' }).tap();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(other).toHaveURL(/\/new$/);
	// The old device is put out of the room, home, since it didn't join as a player.
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByText('This room has a new Storyteller.')).toBeVisible();
	await otherContext.close();
});
