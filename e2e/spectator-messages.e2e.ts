import { expect, test } from '@playwright/test';
import { closePane, openPlayers, openPlayerSheet } from './players.ts';
import { toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';

// Trevor (2026-11-03): "allow storyteller to enable or disable spectators from messaging the
// storyteller. messages would come in under player tab, in a separate Spectator section";
// "spectators would end up being ppl who joined the game but do not have seats". Grim view is
// now given to a phone in the room (2026-11-16), so it writes as that phone does.

/** Writes to the Storyteller from the message button, and waits to hear it arrived. */
async function message(phone: Page, text: string) {
	await phone.getByTestId('message-button').tap();
	const sheet = phone.getByRole('dialog', { name: 'Message the Storyteller' });
	await sheet.getByRole('textbox', { name: 'Message' }).fill(text);
	await sheet.getByRole('button', { name: 'Send' }).tap();
	await expect(sheet).toBeHidden();
	await expect(phone.getByText('Message delivered to the Storyteller')).toBeVisible();
}

test('spectators message the Storyteller, under Spectators, until it is turned off', async ({
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

	// A phone in the room with no seat is a spectator.
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');
	await message(phone, 'Can I watch from here?');

	// Players: the spectators have their own section, apart from the seats.
	await page.goto(board);
	const players = await openPlayers(page);
	await expect(
		players.getByRole('list', { name: 'Players in the room' }).getByRole('listitem')
	).not.toContainText(['Alex']);
	const spectators = players.getByTestId('room-spectators');
	await expect(spectators.getByTestId('room-player')).toHaveText([/Alex\s*No seat/]);
	await expect(
		spectators
			.getByTestId('room-player')
			.filter({ hasText: 'Alex' })
			.getByTestId('room-player-waiting')
	).toHaveText('1');
	await closePane(page);
	const alex = await openPlayerSheet(page, 'Alex');
	await expect(alex.getByTestId('inbox-item')).toContainText('Can I watch from here?');
	// Every message says whether a consult was asked for (Trevor, 2026-11-06).
	await expect(alex.getByTestId('inbox-no-consult')).toHaveText('No consult');

	// The Storyteller turns them off in Game settings (Trevor, 2026-11-16): the spectator may not send now.
	await closePane(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Game settings' })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Game settings' });
	const allow = settings.getByRole('checkbox', {
		name: 'Spectators can message',
		includeHidden: true
	});
	await expect(allow).toBeChecked();
	await settings.getByText('Spectators can message', { exact: true }).tap();
	await expect(allow).not.toBeChecked();
	await expect(phone.getByTestId('message-button')).toBeDisabled();

	// And back on.
	await settings.getByText('Spectators can message', { exact: true }).tap();
	await expect(allow).toBeChecked();
	await expect(phone.getByTestId('message-button')).toBeEnabled();
	await settings.getByRole('button', { name: 'Close' }).tap();
	// What they sent stays.
	const again = await openPlayerSheet(page, 'Alex');
	await expect(again.getByTestId('inbox-item')).toHaveCount(1);
	await closePane(page);
	await phone.context().close();
});
