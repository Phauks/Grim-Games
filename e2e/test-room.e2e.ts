import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Test room (Trevor, 2026-10-30: "a place where i fully control the fake game, and have access
// to a certain number of fake players"; "so i can choose having multiple types of different
// devices"): the Storyteller is the real app in a frame, and fake players, each on a device of
// its own, join its room or one typed in.

async function openRoom(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.goto(`${new URL(page.url()).pathname}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	return (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
}

test('fake players join a room, each on its own device, and can be shown', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/test-room');
	await expect(page.getByTestId('storyteller-frame')).toBeVisible();
	await expect(page.getByTestId('test-room-status')).toHaveText(/^No room/);

	// Two fake players, on two kinds of phone.
	const more = page.getByRole('button', { name: 'More players' });
	await more.tap();
	await more.tap();
	await expect(page.getByTestId('test-room-players')).toHaveText('Players 2');
	const rows = page.getByTestId('test-room-player');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('iPhone SE');
	await expect(rows.nth(1)).toContainText('iPhone 13 mini');

	// The room is storytold on another device, so its code is typed in.
	const storyteller = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	const code = await openRoom(storyteller);
	await page.getByRole('textbox', { name: 'Room code' }).pressSequentially(code);
	await page.getByRole('button', { name: 'Join', exact: true }).tap();
	await expect(page.getByTestId('test-room-status')).toHaveText(
		/^Room \d{3} \d{3} · 2 of 2 players connected$/
	);

	// The Storyteller sees both fake players in the room.
	await storyteller.goto(storyteller.url().replace(/\/room$/, '/players'));
	const inRoom = storyteller.getByRole('list', { name: 'Players in the room' });
	await expect(inRoom).toContainText('Bot 1');
	await expect(inRoom).toContainText('Bot 2');

	// Bot 2 on a Pixel 8, shown as that phone's real screen.
	await page.getByRole('combobox', { name: 'Bot 2’s device' }).tap();
	await page.getByRole('option', { name: 'Pixel 8 · 412×915' }).tap();
	await page.getByRole('button', { name: 'Show Bot 2’s phone' }).tap();
	const phone = page.getByTestId('phone-frame');
	await expect(phone).toHaveCount(1);
	await expect(phone).toContainText('Bot 2 · Pixel 8 · 412×915');
	await expect(phone.locator('iframe')).toHaveAttribute('src', `/join/${code}`);

	// A fast tool: every player locks their screen and drops out of the room.
	await page.getByRole('button', { name: 'Lock every screen', exact: true }).tap();
	await expect(page.getByTestId('test-room-status')).toContainText('0 of 2 players connected');
	await page.getByRole('button', { name: 'Unlock every screen' }).tap();
	await expect(page.getByTestId('test-room-status')).toContainText('2 of 2 players connected');
	await storyteller.context().close();
});
