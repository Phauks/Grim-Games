import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// The Storyteller's soundboard and sounds for actions (plans U6 and U7, Trevor 2026-10-26:
// "bells should be useful to storyteller and initiate bell sounds upon pressing", and
// "connect certain sounds to their actions (such as an execution sound)").

test('the soundboard plays a sound at a tap, and Start game plays the Dusk sound', async ({
	page
}, testInfo) => {
	const fetched: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/board/')) fetched.push(path);
	});
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);

	// On the board beside the day timer, not in the ⋯ menu (Trevor, 2026-10-27: "Sound can be
	// next to timer for now").
	const button = page.getByRole('button', { name: 'Soundboard', exact: true });
	const timer = (await page.getByTestId('day-timer').boundingBox())!;
	const placed = (await button.boundingBox())!;
	// Touching it, beside or under it: the gap between the two is at most a small space.
	const gapX = Math.max(timer.x - (placed.x + placed.width), placed.x - (timer.x + timer.width));
	const gapY = Math.max(timer.y - (placed.y + placed.height), placed.y - (timer.y + timer.height));
	expect(Math.max(gapX, gapY)).toBeLessThan(16);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(menu.getByRole('button', { name: 'Soundboard' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await button.tap();
	const sheet = page.getByRole('dialog', { name: 'Soundboard' });
	const pads = sheet.getByRole('group', { name: 'Soundboard' });
	// Two columns (Trevor, 2026-10-27: "noise controls on one side and the noises on the
	// other"): the pads beside the controls on a tablet, above them on a phone.
	const padsBox = (await sheet.getByTestId('dialog-aside').boundingBox())!;
	const controlsBox = (await sheet.getByTestId('dialog-pane').boundingBox())!;
	if (testInfo.project.name === 'tablet') {
		expect(padsBox.x + padsBox.width).toBeLessThanOrEqual(controlsBox.x);
	} else expect(padsBox.y + padsBox.height).toBeLessThanOrEqual(controlsBox.y);
	await expect(sheet.getByRole('slider', { name: 'Volume', exact: true })).toBeVisible();
	// Every sound, then the dashed "+ New" pad.
	await expect(pads.getByRole('button')).toHaveCount(13);
	// Nothing is fetched until a sound is played.
	expect(fetched).toEqual([]);
	// Pause waits, disabled, until something plays.
	const pause = sheet.getByRole('button', { name: 'Pause', exact: true });
	await expect(pause).toBeDisabled();
	await pads.getByRole('button', { name: 'Hand bell' }).tap();
	await expect.poll(() => fetched).toContain('/sounds/board/hand-bell.mp3');
	// Pause holds it (Trevor, 2026-10-27), and Resume carries on.
	await pause.tap();
	const resume = sheet.getByRole('button', { name: 'Resume', exact: true });
	await resume.tap();
	await expect(pause).toBeVisible();

	// The mixer (Trevor, 2026-10-27: "more mixing controls"): holding a pad picks it, and with
	// overlap on two sounds play at once.
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await sheet.getByText('Let sounds overlap', { exact: true }).tap();
	const heartbeat = pads.getByRole('button', { name: 'Heartbeat', exact: true });
	const box = await heartbeat.boundingBox();
	if (!box) throw new Error('Heartbeat pad has no box');
	await heartbeat.dispatchEvent('pointerdown', {
		button: 0,
		clientX: box.x + box.width / 2,
		clientY: box.y + box.height / 2
	});
	await expect(sheet.getByRole('combobox', { name: 'Sound', exact: true })).toContainText(
		'Heartbeat'
	);
	await heartbeat.dispatchEvent('pointerup');
	await sheet.getByText('Loop until stopped', { exact: true }).tap();
	await heartbeat.tap();
	await pads.getByRole('button', { name: 'Gallows trap' }).tap();
	await expect(heartbeat).toHaveAttribute('aria-pressed', 'true');
	await expect(pads.getByRole('button', { name: 'Gallows trap' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// Heartbeat loops, so it is still playing after the gallows trap ends.
	await expect(pads.getByRole('button', { name: 'Gallows trap' })).toHaveAttribute(
		'aria-pressed',
		'false',
		{ timeout: 10_000 }
	);
	await expect(heartbeat).toHaveAttribute('aria-pressed', 'true');
	await heartbeat.tap();
	await expect(heartbeat).toHaveAttribute('aria-pressed', 'false');
	expect(errors).toEqual([]);
	// Day and night sound is beside it, to change mid-game.
	await expect(sheet.getByRole('combobox', { name: 'Night sound' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// Sounds for actions are off until turned on in Settings > Sound.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	// ⋯ > Settings opens all of Settings at its root.
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	const dusk = settings.getByRole('combobox', { name: 'Dusk' });
	await expect(dusk).toContainText('Temple bell');
	await expect(dusk).toBeDisabled();
	await settings.getByText('Play when I act', { exact: true }).tap();
	await expect(dusk).toBeEnabled();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	// One character, so the bank offers Start game.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const seatSheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await seatSheet.getByRole('button', { name: 'Choose' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Imp', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(seatSheet).toBeHidden();
	await page
		.getByRole('list', { name: 'Reminder bank' })
		.locator('..')
		.getByRole('button', { name: 'Start game', exact: true })
		.tap();
	const ask = page.getByRole('alertdialog', { name: 'Start the game?' });
	await expect(page.getByTestId('night-strip').or(ask)).toBeVisible();
	if (await ask.isVisible()) await ask.getByRole('button', { name: 'Confirm', exact: true }).tap();

	// The first night begins: Dusk's sound plays.
	await expect.poll(() => fetched).toContain('/sounds/board/temple-bell.mp3');
});

// Hot spots (Trevor, 2026-10-27: "perhaps a storyteller only wants access to some. We could
// have some hot spots where storytellers could place sounds and mixes").
test('the soundboard shows only the sounds and mixes placed on it', async ({ page }) => {
	const fetched: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/board/')) fetched.push(path);
	});
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: 'Soundboard', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Soundboard' });
	const pads = sheet.getByRole('group', { name: 'Soundboard' });

	await pads.getByRole('button', { name: 'Add to the soundboard' }).tap();
	const editor = page.getByRole('dialog', { name: 'Edit soundboard' });
	await editor.getByRole('button', { name: 'Remove Hand bell' }).tap();
	await expect(
		editor.getByRole('list', { name: 'Add a sound' }).getByText('Hand bell')
	).toBeVisible();
	await editor.getByRole('button', { name: 'Move Gallows trap up' }).tap();
	await editor.getByRole('textbox', { name: 'Name' }).fill('Doom');
	const sounds = editor.getByRole('group', { name: 'Sounds in the mix' });
	await sounds.getByRole('button', { name: 'Heartbeat', exact: true }).tap();
	await sounds.getByRole('button', { name: 'Horrified crowd' }).tap();
	await editor.getByRole('button', { name: 'Add mix' }).tap();
	await editor.getByRole('button', { name: 'Close' }).tap();
	await expect(editor).toBeHidden();

	// Hand bell is gone, and the mix is last, before "+ New".
	await expect(pads.getByRole('button', { name: 'Hand bell' })).toHaveCount(0);
	await expect(pads.getByRole('button').nth(-2)).toHaveText('Doom');
	// A mix plays its sounds together.
	const doom = pads.getByRole('button', { name: 'Doom' });
	await doom.tap();
	await expect
		.poll(() => fetched)
		.toEqual(
			expect.arrayContaining(['/sounds/board/heartbeat.mp3', '/sounds/board/horrified-crowd.mp3'])
		);
	await expect(doom).toHaveAttribute('aria-pressed', 'true');
	await doom.tap();
	await expect(doom).toHaveAttribute('aria-pressed', 'false');

	// Kept on the device, for the next game too.
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: 'Soundboard', exact: true }).tap();
	await expect(pads.getByRole('button', { name: 'Doom' })).toBeVisible();
	await expect(pads.getByRole('button', { name: 'Hand bell' })).toHaveCount(0);
});
