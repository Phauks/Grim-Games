import { expect, test } from '@playwright/test';
import { openGameInfo, pickScript, toBoard } from './new-game.ts';

// Game info has every line the board corner can show, so a phone whose corner has no room
// still reads them (Trevor, 2026-10-23: "on mobile I can't see the join code or game time").

test('Game info shows the join code, the day or night, Game time and watchers; the code opens Share', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	let info = await openGameInfo(page);
	const row = (field: string) => info.locator(`tr[data-field="${field}"] td:last-child`);
	await expect(row('join-code')).toHaveText('None');
	// Game phase and Game time are lines of their own (Trevor, 2026-10-26); only Game phase
	// says Setup ("game time should no longer say setup").
	await expect(info.locator('tr[data-field="phase"] th')).toHaveText('Game phase');
	await expect(row('phase')).toHaveText('Setup');
	await expect(row('game-time')).toHaveText('0:00');
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
	await expect(row('phase')).toHaveText('Night 1');
	await expect(row('game-time')).toHaveText(/^1:0\d$/);
});

test('an eye on each Game info line chooses what the board corner shows, as Settings > Board does', async ({
	page
}) => {
	// Trevor, 2026-10-24: "an eye toggle on each line in game info, and that is how it is
	// decided what will populate in the bottom left".
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	const corner = page.getByTestId('script-title');
	await expect(corner).toContainText('by The Pandemonium Institute');
	await expect(page.getByTestId('board-players')).toHaveCount(0);

	let info = await openGameInfo(page);
	// Every line but the script's name, which is the way into Game info.
	await expect(info.locator('tr[data-field="script"] [data-testid="corner-eye"]')).toHaveCount(0);
	const author = info.getByRole('button', { name: 'Author on the board' });
	await expect(author).toHaveAttribute('aria-pressed', 'true');
	await author.tap();
	await expect(author).toHaveAttribute('aria-pressed', 'false');
	const players = info.getByRole('button', { name: 'Players on the board' });
	await expect(players).toHaveAttribute('aria-pressed', 'false');
	await players.tap();
	// Game phase and Game time each have their own eye (Trevor, 2026-10-26).
	const phaseEye = info.getByRole('button', { name: 'Game phase on the board' });
	await expect(phaseEye).toHaveAttribute('aria-pressed', 'true');
	// Level with the label it belongs to (Trevor, 2026-10-26: "eyeballs in game info seem
	// slightly higher than the thing they identify with").
	const eyeBox = (await phaseEye.locator('svg').boundingBox())!;
	const labelBox = (await info.locator('tr[data-field="phase"] th').boundingBox())!;
	expect(Math.abs(eyeBox.y + eyeBox.height / 2 - (labelBox.y + labelBox.height / 2))).toBeLessThan(
		2
	);
	await phaseEye.tap();
	await page.keyboard.press('Escape');
	await expect(info).toBeHidden();
	await expect(corner).not.toContainText('by The Pandemonium Institute');
	await expect(page.getByTestId('board-players')).toBeAttached();
	await expect(page.getByTestId('board-phase')).toHaveCount(0);
	await expect(page.getByTestId('board-game-clock')).toContainText('0:00');

	// The same choices in Settings > Board (⋯ > Settings opens there), and after a reload.
	await page.reload();
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board', exact: true })
		.tap();
	const authorSetting = settings.getByRole('checkbox', { name: 'Author', exact: true });
	await expect(authorSetting).not.toBeChecked();
	await settings.getByText('Author', { exact: true }).tap();
	await expect(authorSetting).toBeChecked();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(corner).toContainText('by The Pandemonium Institute');
	info = await openGameInfo(page);
	await expect(info.getByRole('button', { name: 'Author on the board' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
