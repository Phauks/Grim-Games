import { expect, test, type Page } from '@playwright/test';
import { openPlayers, openPlayerSheet } from './players.ts';
import { toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';

// Trevor (2026-11-03): "allow storyteller to enable or disable spectators from messaging the
// storyteller. messages would come in under player tab, in a separate Spectator section";
// "spectators would end up being ppl who joined the game but do not have seats ... similarly,
// those with grim view could also message storyteller".

/** Types a room code into Join game's code boxes. */
async function typeCode(phone: Page, code: string) {
	const field = phone.getByRole('textbox', { name: 'Room Code' });
	await field.tap();
	await field.pressSequentially(code);
}

/** Writes to the Storyteller from the message button, and waits to hear it arrived. */
async function message(phone: Page, text: string) {
	await phone.getByTestId('message-button').tap();
	const sheet = phone.getByRole('dialog', { name: 'Message the Storyteller' });
	await sheet.getByRole('textbox', { name: 'Message' }).fill(text);
	await sheet.getByRole('button', { name: 'Send' }).tap();
	await expect(sheet).toBeHidden();
	await expect(phone.getByText('Message delivered to the Storyteller')).toBeVisible();
}

test('spectators and Grim view message the Storyteller, under Spectators, until it is turned off', async ({
	page,
	browser
}, testInfo) => {
	test.setTimeout(90_000);
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('tab', { name: 'Grimoire' }).tap();
	const watch = page.getByTestId('watch-link');
	await watch.getByText('Grim view', { exact: true }).tap();
	const password = await watch.getByLabel('Grim view password', { exact: true }).inputValue();
	expect(password).not.toBe('');

	// A phone in the room with no seat is a spectator.
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await message(phone, 'Can I watch from here?');

	// Someone on Grim view, with their Profile's name, writes from beside ☰.
	const viewer = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	// The Profile's name as this device keeps it (set in Settings > Profile on a phone).
	await viewer.addInitScript(() =>
		localStorage.setItem('grim-games-room-name', JSON.stringify('Pat'))
	);
	await viewer.goto('/join');
	await typeCode(viewer, code);
	await expect(viewer.getByTestId('room-preview')).toContainText('Trouble Brewing');
	await viewer.getByRole('button', { name: 'More ways to join' }).tap();
	await viewer.getByRole('menuitem', { name: 'Grim view' }).tap();
	const ask = viewer.getByRole('dialog', { name: 'Grim view' });
	await ask.getByLabel('Grim view password', { exact: true }).fill(password);
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await viewer
		.getByRole('alertdialog', { name: 'Before you watch' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(viewer.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();
	await expect(viewer.getByTestId('message-button')).toBeEnabled();
	await message(viewer, 'Lovely game so far');

	// Players: the spectators have their own section, apart from the seats.
	await page.goto(board);
	const players = await openPlayers(page);
	await expect(
		players.getByRole('list', { name: 'Players in the room' }).getByRole('listitem')
	).not.toContainText(['Alex']);
	const spectators = players.getByTestId('room-spectators');
	await expect(spectators.getByTestId('room-player')).toHaveText([
		/Alex\s*No seat/,
		/Pat\s*Grim view/
	]);
	await expect(
		spectators
			.getByTestId('room-player')
			.filter({ hasText: 'Pat' })
			.getByTestId('room-player-waiting')
	).toHaveText('1');
	await page.keyboard.press('Escape');
	await expect(players).toBeHidden();
	const alex = await openPlayerSheet(page, 'Alex');
	await expect(alex.getByTestId('inbox-item')).toContainText('Can I watch from here?');
	await page.keyboard.press('Escape');
	const pat = await openPlayerSheet(page, 'Pat');
	await expect(pat.getByTestId('room-player-where')).toHaveText('Grim view');
	await expect(pat.getByTestId('inbox-item')).toContainText('Lovely game so far');

	// The Storyteller turns them off: neither may send now.
	const allow = spectators.getByRole('checkbox', {
		name: 'Spectators can message',
		includeHidden: true
	});
	await expect(allow).toBeChecked();
	await spectators.getByText('Spectators can message', { exact: true }).tap();
	await expect(allow).not.toBeChecked();
	await expect(phone.getByTestId('message-button')).toBeDisabled();
	await expect(viewer.getByTestId('message-button')).toBeDisabled();
	// What they sent stays.
	await expect(pat.getByTestId('inbox-item')).toHaveCount(1);

	// And back on.
	await spectators.getByText('Spectators can message', { exact: true }).tap();
	await expect(allow).toBeChecked();
	await expect(phone.getByTestId('message-button')).toBeEnabled();
	await expect(viewer.getByTestId('message-button')).toBeEnabled();
	await phone.context().close();
	await viewer.context().close();
});
