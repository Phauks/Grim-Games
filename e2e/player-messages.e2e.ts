import { expect, test } from '@playwright/test';
import { openPlayers, openPlayerSheet } from './players.ts';
import { toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';

// Players' messages to the Storyteller (Trevor, 2026-10-27): "Unilateral messaging to
// storyteller. Combine into a communication menu where notifications from players about bad
// images also goes"; "Players cannot see message once sent"; and on the grim cover, "don't
// show who, but show notifications".

test('a player messages the Storyteller, who reads it on Players; the cover shows only a count', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	// Players (with its messages) is only ever in ⋯, never on the toolbar (Trevor, 2026-10-28).
	await expect(page.getByTestId('toolbar-messages')).toHaveCount(0);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page.getByTestId('cover-button')).toBeVisible();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, 'Alex');
	await phone.keyboard.press('Escape');

	// The message goes, and the phone keeps nothing of it.
	const button = phone.getByTestId('message-button');
	await expect(button).toBeEnabled();
	await button.tap();
	let sheet = phone.getByRole('dialog', { name: 'Message the Storyteller' });
	// Asked to play fair first (Trevor, 2026-10-27), as everywhere a phone could be misused.
	await expect(sheet.getByTestId('fair-play')).toContainText(
		/only send what the Storyteller needs to know/i
	);
	await expect(sheet.getByRole('button', { name: 'Send' })).toBeDisabled();
	await sheet.getByRole('textbox', { name: 'Message' }).fill('Can I swap seats with Sam?');
	// A consult can be asked for with the words (Trevor, 2026-10-27).
	await sheet.getByText('Request a Storyteller consult', { exact: true }).tap();
	await sheet.getByRole('button', { name: 'Send' }).tap();
	await expect(sheet).toBeHidden();
	// The phone is told it arrived, and nothing more (Trevor, 2026-10-28).
	await expect(phone.getByText('Message delivered to the Storyteller')).toBeVisible();
	await button.tap();
	sheet = phone.getByRole('dialog', { name: 'Message the Storyteller' });
	await expect(sheet.getByRole('textbox', { name: 'Message' })).toHaveValue('');
	await expect(
		sheet.getByRole('checkbox', { name: 'Request a Storyteller consult', includeHidden: true })
	).not.toBeChecked();
	await expect(sheet).not.toContainText('swap');
	await phone.keyboard.press('Escape');

	// The grim cover says a message waits, never who sent it or what it says.
	await page.getByTestId('cover-button').tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await expect(cover.getByTestId('cover-inbox')).toHaveText('1 new message');
	await expect(cover).not.toContainText('Alex');
	await expect(cover).not.toContainText('swap');
	await cover.getByRole('button', { name: 'Close' }).tap();
	await expect(cover).toBeHidden();

	// Players shows who has sent something (Trevor, 2026-10-29: Messages folded into Players);
	// a consult makes the count stand out.
	const players = await openPlayers(page);
	const row = players.getByTestId('room-player').filter({ hasText: 'Alex' });
	await expect(row.getByTestId('room-player-waiting')).toHaveText('1');
	await expect(row.getByTestId('room-player-waiting')).toHaveAttribute('data-warn', '');
	await page.keyboard.press('Escape');
	await expect(players).toBeHidden();
	// Their sheet has what they sent, each in its own box (Trevor, 2026-10-28); a message is
	// read only once it is opened on its own, and can be marked unread again.
	const alexSheet = await openPlayerSheet(page, 'Alex');
	const item = alexSheet.getByTestId('inbox-item');
	await expect(item).toHaveCount(1);
	await expect(item).toContainText('Can I swap seats with Sam?');
	await expect(item.getByTestId('inbox-consult')).toHaveText('Consult requested');
	await expect(item).toContainText('New');
	await item.tap();
	const opened = page.getByRole('dialog', { name: 'Message', exact: true });
	await expect(opened.getByTestId('inbox-opened')).toContainText('Can I swap seats with Sam?');
	await expect(opened.getByTestId('inbox-consult')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(opened).toBeHidden();
	await expect(item).not.toContainText('New');
	await item.tap();
	await opened.getByRole('button', { name: 'Mark as unread' }).tap();
	await expect(opened).toBeHidden();
	await expect(item).toContainText('New');
	await item.tap();
	await page.keyboard.press('Escape');
	await expect(row.getByTestId('room-player-waiting')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(players).toBeHidden();
	await expect(page.getByRole('button', { name: /new message/ })).toHaveCount(0);
	await page.getByTestId('cover-button').tap();
	await expect(cover.getByTestId('cover-inbox')).toBeHidden();
	await phoneContext.close();
});
