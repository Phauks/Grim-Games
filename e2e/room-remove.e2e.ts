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

test('the Storyteller removes a phone for this game, and can let it back in', async ({
	page,
	browser
}, testInfo) => {
	const code = await openRoom(page);
	await page.goto(page.url().replace(/\/room$/, '/players'));
	const unseated = page
		.getByRole('list', { name: 'Players in the room' })
		.getByRole('listitem')
		.filter({ hasText: 'No seat' });
	const removed = page.getByTestId('room-removed');
	// Always there, so removing someone moves nothing.
	await expect(removed).toContainText('None');
	const phone = await joinAs(browser, testInfo, code, 'Ana');
	await expect(unseated).toHaveText([/Ana\s*No seat/]);

	// The red trash on the player's row asks first.
	await unseated.getByTestId('room-player-remove').tap();
	await page
		.getByRole('alertdialog', { name: 'Remove this player from the room?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(unseated).toHaveCount(0);
	await expect(removed.getByTestId('room-removed-player')).toHaveText([/Ana/]);
	await expect(phone.getByRole('alert')).toHaveText('The Storyteller removed you from this game.');

	// Trying again is turned away while the removal stands.
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('alert')).toHaveText('The Storyteller removed you from this game.');
	await expect(unseated).toHaveCount(0);

	// Let back in: the phone joins again, with no seat.
	await removed.getByRole('button', { name: 'Let back in' }).tap();
	await expect(removed).toContainText('None');
	await phone.goto(`/join/${code}`);
	await expect(unseated).toHaveText([/Ana\s*No seat/]);
	await phone.context().close();
});
