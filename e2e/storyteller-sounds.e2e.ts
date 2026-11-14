import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Players opt in or out of the Storyteller's sounds on their phone (Trevor, 2026-11-14: "make
// it so that players can opt in or out of this feature ... have them just approve and be able
// to turn on or off"). Asked on joining a room (his pick, B), the answer kept for later games
// ("save setting between games"), and changed with a switch in Settings > Sound.

/** Starts a Trouble Brewing game with one Imp, in a room, and says the room code. */
async function roomGame(page: Page): Promise<{ board: string; code: string }> {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.goto(board);
	return { board, code };
}

/** Turns on day and night sound for players' phones alone, in the board's Settings > Sound. */
async function soundOnPhones(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	await settings.getByText('Play during the game', { exact: true }).tap();
	await settings.getByRole('combobox', { name: 'Play on' }).tap();
	await page.getByRole('option', { name: 'Players’ phones', exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(settings).toBeHidden();
}

async function startNight(page: Page): Promise<void> {
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(page.getByTestId('night-strip').or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();
}

test('a player is asked on joining, plays nothing until they say yes, and is not asked again', async ({
	page,
	browser
}, testInfo) => {
	const { code } = await roomGame(page);
	await soundOnPhones(page);

	// A phone that has never answered.
	const phoneContext = await browser.newContext({
		...testInfo.project.use,
		storageState: { cookies: [], origins: [] }
	});
	const phone = await phoneContext.newPage();
	const fetched: string[] = [];
	phone.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/ambience/')) fetched.push(path);
	});
	await phone.goto(`/join/${code}`);
	const question = phone.getByRole('alertdialog', { name: 'Play the Storyteller’s sounds?' });
	await expect(question).toBeVisible();
	await question.getByRole('button', { name: 'Cancel', exact: true }).tap();
	await expect(question).toBeHidden();

	// No: the night's recording never reaches this phone.
	await startNight(page);
	await phone.waitForTimeout(1000);
	expect(fetched).toEqual([]);

	// The answer is kept: back in the room, nobody asks again.
	await phone.reload();
	await expect(phone.getByTestId('join-status')).toHaveText('');
	await phone.waitForTimeout(500);
	await expect(question).toBeHidden();

	// Settings > Sound changes it, and the night's recording starts at once.
	await phone.getByRole('button', { name: 'Settings', exact: true }).first().tap();
	const settings = phone.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	const toggle = settings.getByRole('checkbox', { name: 'Play the Storyteller’s sounds' });
	await expect(toggle).not.toBeChecked();
	await settings.getByText('Play the Storyteller’s sounds', { exact: true }).tap();
	await expect(toggle).toBeChecked();
	await expect.poll(() => fetched).toContain('/sounds/ambience/night-meadow.mp3');
	await phoneContext.close();
});

test('saying yes on joining plays the Storyteller’s sounds', async ({
	page,
	browser
}, testInfo) => {
	const { code } = await roomGame(page);
	await soundOnPhones(page);
	const phoneContext = await browser.newContext({
		...testInfo.project.use,
		storageState: { cookies: [], origins: [] }
	});
	const phone = await phoneContext.newPage();
	const fetched: string[] = [];
	phone.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/ambience/')) fetched.push(path);
	});
	await phone.goto(`/join/${code}`);
	const question = phone.getByRole('alertdialog', { name: 'Play the Storyteller’s sounds?' });
	await question.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(question).toBeHidden();
	await startNight(page);
	await expect.poll(() => fetched).toContain('/sounds/ambience/night-meadow.mp3');
	await phoneContext.close();
});
