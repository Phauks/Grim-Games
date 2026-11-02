import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Back to town (plan U2, Trevor 2026-10-26: "Back to town button on storyteller, which buzzes
// or makes music on other phones when picked"): the board's ⋯ calls every phone in the room.

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	return new URL(page.url()).pathname;
}

test('Back to town makes every phone in the room sound and vibrate', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	// On the day timer (Trevor, 2026-11-01), not in ⋯. Without a room there is nobody to
	// call: it is there, disabled, so nothing moves when a room opens.
	const timer = page.locator('.board-timer').getByTestId('day-timer');
	const call = timer.getByRole('button', { name: 'Back to town' });
	await expect(call).toBeDisabled();
	const before = (await timer.boundingBox())!;
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	await expect(menu.getByRole('button', { name: 'Back to town' })).toHaveCount(0);
	await page.keyboard.press('Escape');

	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	// Records the phone's vibrations and sounds, which a test can't feel or hear.
	await phone.addInitScript(() => {
		const calls: string[] = [];
		(window as unknown as { alerts: string[] }).alerts = calls;
		navigator.vibrate = () => (calls.push('vibrate'), true);
		const start = OscillatorNode.prototype.start;
		OscillatorNode.prototype.start = function (when?: number) {
			if (!calls.includes('sound')) calls.push('sound');
			start.call(this, when);
		};
	});
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');
	// Any tap lets the page make sounds later (browsers' rule).
	await phone.getByRole('tab', { name: 'Script' }).tap();

	await page.goto(board);
	await expect(call).toBeEnabled();
	expect((await timer.boundingBox())!.width).toBe(before.width);
	// A Cancel/Confirm sheet first (Trevor, 2026-10-27): Cancel calls nobody.
	const confirm = page.getByRole('alertdialog', { name: 'Back to town?' });
	await call.tap();
	await confirm.getByRole('button', { name: 'Cancel' }).tap();
	await expect(confirm).toBeHidden();
	await page.waitForTimeout(500);
	expect(await phone.evaluate(() => (window as unknown as { alerts: string[] }).alerts)).toEqual(
		[]
	);
	await call.tap();
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(confirm).toBeHidden();

	await expect(phone.getByText('Back to town', { exact: true })).toBeVisible();
	await expect
		.poll(() => phone.evaluate(() => (window as unknown as { alerts: string[] }).alerts))
		.toEqual(['vibrate', 'sound']);

	// From the grim cover too, which stays up (Trevor, 2026-10-27). The room takes one call
	// at a time, so the call above is the one the phone hears.
	await page.getByTestId('cover-button').tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await cover.getByRole('button', { name: 'Back to town' }).tap();
	await expect(confirm).toBeVisible();
	await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(confirm).toBeHidden();
	await expect(cover).toBeVisible();
	await phoneContext.close();
});
