import { expect, test } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

// The Storyteller's soundboard and sounds for actions (plans U6 and U7, Trevor 2026-10-26:
// "bells should be useful to storyteller and initiate bell sounds upon pressing", and
// "connect certain sounds to their actions (such as an execution sound)").

test('the soundboard plays a sound at a tap, and Start game plays the Dusk sound', async ({
	page
}) => {
	const fetched: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/sounds/board/')) fetched.push(path);
	});
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);

	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Soundboard' })
		.tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	const pads = sheet.getByRole('group', { name: 'Soundboard' });
	await expect(pads.getByRole('button')).toHaveCount(12);
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
		.getByRole('button', { name: 'Sound', exact: true })
		.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	const dusk = settings.getByRole('combobox', { name: 'Dusk' });
	await expect(dusk).toContainText('Temple bell');
	await expect(dusk).toBeDisabled();
	await settings.getByText('Play when I act', { exact: true }).tap();
	await expect(dusk).toBeEnabled();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	// One character, so the bank offers Start game.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
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

	// The first night begins: Dusk's sound plays.
	await expect.poll(() => fetched).toContain('/sounds/board/temple-bell.mp3');
});
