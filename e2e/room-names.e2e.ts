import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { openProfile, setPlayerName } from './player-name.ts';
import { toBoard } from './new-game.ts';

// Two players may give the same name (Trevor, 2026-10-27: "shouldn't refuse"): the Storyteller
// sees the later one numbered by join order, and that phone is told so it can change its name.

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

/** A phone of its own (a phone's key is kept in its storage) that joins with `name`. */
async function joinAs(browser: Browser, testInfo: TestInfo, code: string, name: string) {
	const phone = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await phone.goto(`/join/${code}`);
	await openProfile(phone);
	await setPlayerName(phone, name);
	return phone;
}

test('a name two players share is numbered by join order until one changes it', async ({
	page,
	browser
}, testInfo) => {
	const code = await openRoom(page);
	const players = page.getByRole('list', { name: 'Players in the room' }).getByRole('listitem');
	const first = await joinAs(browser, testInfo, code, 'John');
	await expect(players).toHaveText([/^John\s*No seat$/]);
	const second = await joinAs(browser, testInfo, code, 'John');
	await expect(players).toHaveText([/^John\s*No seat$/, /^John 2\s*No seat$/]);

	// The second phone is told, and its name row shows the name the Storyteller sees.
	await expect(second.getByText('Another player is called John')).toBeVisible();
	const settings = second.getByRole('dialog', { name: 'Settings' });
	await expect(settings.getByTestId('player-name')).toHaveText('John 2');
	await expect(
		first.getByRole('dialog', { name: 'Settings' }).getByTestId('player-name')
	).toHaveText('John');

	// Changing the name takes the number away.
	await setPlayerName(second, 'Jon');
	await expect(settings.getByTestId('player-name')).toHaveText('Jon');
	await expect(players).toHaveText([/^John\s*No seat$/, /^Jon\s*No seat$/]);
	await first.context().close();
	await second.context().close();
});
