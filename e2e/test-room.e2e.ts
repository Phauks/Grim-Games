import { expect, test } from '@playwright/test';

// Test room (Trevor, 2026-10-30: "an interface, with ability to mockup sizing for different
// phones"): the real join screen in phone-sized frames, each its own player, with bots in the
// same room.

test('a test room fills with bots and phone frames, each frame its own device', async ({
	page
}) => {
	await page.goto('/test-room');
	const frames = page.getByTestId('phone-frame');
	await expect(frames).toHaveCount(3);
	await expect(page.getByTestId('test-room-status')).toHaveText('No room');

	// Two bots, then a room this page storytells.
	const fewer = page.getByRole('button', { name: 'Fewer bots' });
	for (let n = 8; n > 2; n--) await fewer.tap();
	await expect(page.getByTestId('test-room-bots')).toHaveText('Bots 2');
	await page.getByRole('button', { name: 'New test room' }).tap();
	const status = page.getByTestId('test-room-status');
	await expect(status).toHaveText(/^Room \d{3} \d{3} · 2 of 2 bots connected$/);
	const code = (await status.textContent())!
		.match(/(\d{3}) (\d{3})/)!
		.slice(1)
		.join('');

	// Each frame is the join screen of that room, at its phone's own size.
	const first = frames.first();
	await expect(first).toContainText('iPhone SE · 375×667');
	await expect(first.locator('iframe')).toHaveAttribute('src', `/join/${code}`);
	await expect(
		page.frameLocator('iframe').first().getByRole('heading', { name: 'Continue game' })
	).toBeVisible();
	// Each frame keeps its device key apart (stored.ts), so it joins as its own player.
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					new Set(
						Object.keys(localStorage)
							.filter((k) => k.endsWith(':grim-games-room-player'))
							.map((k) => localStorage.getItem(k))
					).size
			)
		)
		.toBe(3);

	await first.getByRole('button', { name: 'Remove iPhone SE' }).tap();
	await expect(frames).toHaveCount(2);

	await page.getByRole('button', { name: 'Leave' }).tap();
	await expect(status).toHaveText('No room');
});
