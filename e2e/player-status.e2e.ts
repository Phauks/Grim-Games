import { expect, test, type WebSocketRoute } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { expectInRoom } from './player-status.ts';

// One status box over the player screen's tabs, one thing at a time (Trevor, 2026-11-16:
// "unify into one, and A"): a phone that loses its room mid-game says so in the game's place,
// in a box of the same size, and shows the game again once it is back.

test('a phone that drops mid-game says Offline in the game status box, which keeps its size', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	// The phone's room link runs through here, so the test can cut it as a dropped signal would.
	let cut = false;
	const links: WebSocketRoute[] = [];
	await phone.routeWebSocket(/\/api\/room\//, (ws) => {
		if (cut) return void ws.close();
		ws.connectToServer();
		links.push(ws);
	});
	await phone.goto(`/join/${code}`);
	const row = phone.getByTestId('player-status-row');
	await expectInRoom(phone);
	const game = phone.getByTestId('players-status');
	await expect(row).toHaveAttribute('data-status', 'phase');
	await expect(game).toBeVisible();
	const before = (await row.boundingBox())!;

	cut = true;
	for (const ws of links) await ws.close();
	await expect(row).toHaveAttribute('data-status', 'offline');
	await expect(phone.getByTestId('join-status')).toHaveText('Offline: reconnecting…');
	await expect(game).toBeHidden();
	const offline = (await row.boundingBox())!;
	expect(Math.abs(offline.height - before.height)).toBeLessThan(1);
	expect(Math.abs(offline.y - before.y)).toBeLessThan(1);

	cut = false;
	await expect(row).toHaveAttribute('data-status', 'phase', { timeout: 30_000 });
	await expect(game).toBeVisible();
	await expect(phone.getByTestId('join-status')).toHaveCount(0);
	await phoneContext.close();
});
