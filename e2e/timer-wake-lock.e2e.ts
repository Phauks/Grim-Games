import { expect, test } from '@playwright/test';

// The screen stays on while the day timer runs, so a phone doesn't lock mid-day (Trevor,
// 2026-10-19). The Screen Wake Lock API is stubbed to count what is held.

test('the day timer keeps the screen on while it runs, by a switch', async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { held: number };
		w.held = 0;
		Object.defineProperty(navigator, 'wakeLock', {
			configurable: true,
			value: {
				request: async () => {
					w.held++;
					const lock = new EventTarget() as EventTarget & { release(): Promise<void> };
					lock.release = async () => {
						w.held--;
						lock.dispatchEvent(new Event('release'));
					};
					return lock;
				}
			}
		});
	});
	const held = () => page.evaluate(() => (window as unknown as { held: number }).held);
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: 'Day', exact: true }).tap();
	const timer = page.getByTestId('day-toolbar').getByTestId('day-timer');
	expect(await held()).toBe(0);
	await timer.getByRole('button', { name: 'Start timer' }).tap();
	await expect.poll(held).toBe(1);
	await timer.getByRole('button', { name: 'Pause timer' }).tap();
	await expect.poll(held).toBe(0);

	// The switch sits beside the timer's other choices, and takes effect while it runs.
	await timer.getByRole('button', { name: 'Start timer' }).tap();
	await expect.poll(held).toBe(1);
	await page.keyboard.press('Escape');
	const board = page.locator('.board-timer').getByTestId('day-timer');
	await board.getByRole('button', { name: /^Day timer, \d+:\d\d; open its controls$/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Day timer' });
	const keepOn = sheet.getByRole('checkbox', { name: 'Keep screen on' });
	await expect(keepOn).toBeChecked();
	await sheet.getByText('Keep screen on', { exact: true }).tap();
	await expect(keepOn).not.toBeChecked();
	await expect.poll(held).toBe(0);
	await sheet.getByText('Keep screen on', { exact: true }).tap();
	await expect.poll(held).toBe(1);
});
