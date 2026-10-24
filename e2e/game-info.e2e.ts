import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// Game info has every line the board corner can show, so a phone whose corner has no room
// still reads them (Trevor, 2026-10-23: "on mobile I can't see the join code or game time").

async function openGameInfo(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const more = page.getByRole('dialog', { name: 'Grimoire' });
	const entry = more.getByRole('button', { name: 'Game info' });
	if (await entry.count()) await entry.tap();
	else {
		await page.keyboard.press('Escape');
		await expect(more).toBeHidden();
		await page.getByTestId('mode-menu').tap();
	}
	return page.getByRole('dialog', { name: 'Game info', exact: true });
}

test('Game info shows the join code, the day or night with Game time, and watchers; the code opens Share', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	let info = await openGameInfo(page);
	const row = (field: string) => info.locator(`tr[data-field="${field}"] td`);
	await expect(row('join-code')).toHaveText('None');
	// The day or night leads Game time, as on the corner (Trevor, 2026-10-24).
	await expect(row('game-time')).toHaveText('Setup');
	await expect(row('watchers')).toHaveText('None');

	// The join code opens Share, which opens the room; its code then shows in Game info.
	await info.getByTestId('info-join-code').tap();
	const share = page.getByRole('dialog', { name: 'Share' });
	const code = share.getByTestId('share-code');
	await expect(code).toHaveText(/^\d{3} \d{3}$/);
	const shown = (await code.textContent())!;
	await share.getByRole('button', { name: 'Close', exact: true }).tap();
	await expect(share).toBeHidden();

	// Game time counts from the first night.
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
	await page.clock.runFor(65_000);

	info = await openGameInfo(page);
	await expect(row('join-code')).toHaveText(shown);
	await expect(row('game-time')).toHaveText(/^Night 1 · 1:0\d$/);
});
