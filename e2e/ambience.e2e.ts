import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Day and night sound (plan U3, Trevor 2026-10-26: "Ambient sound during the day or night",
// one recording at a time, Trevor's pick of the same day): off until turned on, and only once
// the first night begins does the night's recording play. Never on the Storyteller's own
// device (Trevor, 2026-10-30: "Do not play audio from storytellers device ... Only play remote
// on other devices"): the phones in the room fetch and play it, and the board fetches nothing.

test('day and night sound plays on phones in the room once the night begins, never the board', async ({
	page,
	browser
}, testInfo) => {
	const onBoard: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/ambience/')) onBoard.push(path);
	});
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	const fetched: string[] = [];
	phone.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/ambience/')) fetched.push(path);
	});
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');
	// Any tap lets the page make sounds later (browsers' rule).
	await phone.getByRole('tab', { name: 'Script' }).tap();
	await page.goto(board);

	// From the board's ⋯ > Settings, which opens all of Settings (Trevor, 2026-10-27).
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
	await expect(settings.getByRole('heading', { name: 'Day and night sound' })).toBeVisible();
	const on = settings.getByRole('checkbox', { name: 'Play during the game' });
	await expect(on).not.toBeChecked();
	// Every row is in place while it is off, disabled.
	await expect(settings.getByRole('slider', { name: 'Level', exact: true })).toBeDisabled();
	const night = settings.getByRole('combobox', { name: 'Night sound' });
	await expect(night).toContainText('Evening meadow');
	await expect(night).toBeDisabled();
	await expect(settings.getByRole('combobox', { name: 'Day sound' })).toBeDisabled();

	await settings.getByText('Play during the game', { exact: true }).tap();
	await expect(on).toBeChecked();
	await expect(night).toBeEnabled();
	await expect(settings.getByRole('slider', { name: 'Level', exact: true })).toBeEnabled();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();
	// Nothing plays in Setup, so nothing is fetched yet.
	expect(fetched).toEqual([]);

	// One character, so the bank offers Start game.
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
	const strip = page.getByTestId('night-strip');
	await expect(strip.or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// The night's recording starts at once on the phone, the Evening meadow by default, and it
	// is the only one playing.
	await expect.poll(() => fetched).toContain('/sounds/ambience/night-meadow.mp3');
	expect(fetched.filter((path) => path.startsWith('/sounds/ambience/night-'))).toEqual([
		'/sounds/ambience/night-meadow.mp3'
	]);
	expect(onBoard).toEqual([]);
	await phoneContext.close();
});
