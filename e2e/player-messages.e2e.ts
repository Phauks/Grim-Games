import { expect, test } from '@playwright/test';
import { openInbox } from './inbox.ts';
import { toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';

// Players' messages to the Storyteller (Trevor, 2026-10-27): "Unilateral messaging to
// storyteller. Combine into a communication menu where notifications from players about bad
// images also goes"; "Players cannot see message once sent"; and on the grim cover, "don't
// show who, but show notifications".

test('a player messages the Storyteller, who reads it in Messages; the cover shows only a count', async ({
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
	// No room yet: Messages stays in its place on a tablet's toolbar, disabled.
	if (await page.getByTestId('toolbar-messages').isVisible()) {
		await expect(page.getByTestId('toolbar-messages')).toBeDisabled();
	}
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

	// Messages shows who and what, each in its own box (Trevor, 2026-10-28); a message is read
	// only once it is opened on its own, and can be marked unread again.
	const inbox = await openInbox(page);
	const item = inbox.getByTestId('inbox-item');
	await expect(item).toHaveCount(1);
	await expect(item).toContainText('Alex');
	await expect(item).toContainText('Can I swap seats with Sam?');
	await expect(item.getByTestId('inbox-consult')).toHaveText('Consult requested');
	await expect(item).toContainText('New');
	await page.keyboard.press('Escape');
	await expect(inbox).toBeHidden();
	await expect(page.getByRole('button', { name: /1 new message/ }).first()).toBeVisible();
	await openInbox(page);
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
	// Filters by player, read or unread, and a request for a consult (Trevor, 2026-10-28).
	const filters = inbox.getByTestId('inbox-filters');
	await filters.getByRole('button', { name: 'Unread', exact: true }).tap();
	await expect(item).toHaveCount(0);
	await expect(inbox).toContainText('None');
	await filters.getByRole('button', { name: 'Unread', exact: true }).tap();
	await filters.getByRole('button', { name: 'Read', exact: true }).tap();
	await expect(item).toHaveCount(1);
	await filters.getByRole('combobox', { name: 'Player' }).tap();
	await page.getByRole('option', { name: 'Alex', exact: true }).tap();
	await expect(item).toHaveCount(1);
	await filters.getByRole('button', { name: 'Consult requested', exact: true }).tap();
	await expect(item).toHaveCount(1);
	await item.tap();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await expect(inbox).toBeHidden();
	await expect(page.getByRole('button', { name: /new message/ })).toHaveCount(0);
	await page.getByTestId('cover-button').tap();
	await expect(cover.getByTestId('cover-inbox')).toBeHidden();
	await phoneContext.close();
});
