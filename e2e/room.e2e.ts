import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { nameStoryteller } from './new-game.ts';

// Players' phones in a live room (07-accounts-and-multi-device.md §4.2): a phone asks for a
// seat and name, the Storyteller approves, and the seat is named in the grimoire.

async function startGame(page: Page, storyteller?: string) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	if (storyteller !== undefined) await nameStoryteller(page, storyteller);
	return new URL(page.url()).pathname;
}

test('a phone joins, asks for a seat, and the Storyteller seats it', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	expect(code).toMatch(/^\d{6}$/);
	// The icon beside the code copies the code alone, ungrouped (Trevor, 2026-10-19).
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Copy code' }).tap();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('heading', { level: 1 })).toHaveText(/^Room \d{3} \d{3}$/);
	await expect(phone.getByRole('listitem')).toHaveCount(8);
	await phone.getByRole('textbox', { name: 'Your name' }).fill('Alex');
	await phone.getByText('Seat 3', { exact: true }).tap();
	await phone.getByRole('button', { name: 'Ask the Storyteller' }).tap();
	await expect(phone.getByTestId('join-status')).toHaveText(
		'Waiting for the Storyteller: Alex, seat 3.'
	);

	const request = page.getByRole('listitem', { name: 'Alex asks for Seat 3' });
	await request.getByRole('button', { name: 'Approve' }).tap();
	await expect(page.getByRole('listitem').filter({ hasText: 'Alex · Seat 3' })).toBeVisible();

	await expect(phone.getByTestId('join-status')).toHaveText('You are in seat 3 as Alex.');
	await expect(phone.locator('ol li').nth(2)).toContainText('Alex');

	// Coming back (Trevor, 2026-10-19: "it booted me out like I had not joined it yet"): Join
	// game lists the room, and opening it shows the seat this phone already has.
	await phone.goto('/join');
	const recent = phone.getByTestId('recent-rooms').getByRole('button');
	await expect(recent).toHaveCount(1);
	await expect(recent).toContainText('Trouble Brewing');
	await expect(recent).toContainText(`${code.slice(0, 3)} ${code.slice(3)}`);
	await recent.tap();
	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	await expect(phone.getByTestId('join-status')).toHaveText('You are in seat 3 as Alex.');
	await expect(phone.getByRole('radio', { name: /^Seat 3/ })).toBeChecked();
	await expect(phone.getByRole('button', { name: 'Ask the Storyteller' })).toBeDisabled();

	// Approving named the seat on the board, as an ordinary change.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 3: Alex"]')).toBeVisible();

	// Closing the room sends the phone back to the code form.
	await page.goto(`${board}/room`);
	await page.getByRole('button', { name: 'Close room' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Open a room' })).toBeVisible();
	await expect(phone.getByRole('alert')).toHaveText('This room is closed, or the code is wrong.');
	// A closed room leaves the list.
	await phone.goto('/join');
	await expect(phone.getByTestId('recent-rooms')).toHaveCount(0);
	await phoneContext.close();
});

test('a phone that joins gets the game script before anyone has a seat', async ({
	page,
	browser
}, testInfo) => {
	// A game with no characters assigned yet: the room can open while the game is in setup.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('room-script')).toHaveText('Script: Trouble Brewing');
	await expect(phone.getByTestId('join-status')).toHaveText(
		'Choose your seat and type your name, then ask the Storyteller.'
	);
	await phone.getByRole('button', { name: 'Read the script' }).tap();
	await expect(phone).toHaveURL(/\/play$/);
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await phoneContext.close();
});

test('Share and Copy link carry the room code as well as the link', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.addInitScript(() => {
		const w = window as unknown as { shared?: ShareData };
		Object.defineProperty(navigator, 'share', {
			configurable: true,
			value: async (data: ShareData) => void (w.shared = data)
		});
	});
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\D/g, '');
	expect(code).toMatch(/^\d{6}$/);
	const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
	const link = new RegExp(`/join/${code}$`);
	// The game's script logo sits in the middle of the join QR (Trevor, 2026-10-19).
	const qr = page.getByRole('img', { name: 'QR code to join the room' });
	await expect(qr.getByTestId('script-logo')).toHaveAttribute('data-logo', '/data/logos/tb.webp');
	await expect(qr.getByTestId('qr-name')).toHaveCount(0);

	// The join link's buttons come first; the view-only grimoire link's follow.
	await page.getByRole('button', { name: 'Share', exact: true }).first().tap();
	const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
	expect(shared.text).toContain(spaced);
	expect(shared.url).toMatch(link);

	await page.getByRole('button', { name: 'Copy link' }).first().tap();
	const copied = await page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toContain(spaced);
	expect(copied.split('\n').at(-1)).toMatch(link);
});

test('a phone can type a code, and wrong codes say so', async ({ page }) => {
	await page.goto('/join/12345');
	await expect(page.getByRole('alert')).toHaveText(
		'That is not a room code. Codes are six digits.'
	);
	await page.goto('/join');
	const join = page.getByRole('button', { name: 'Join' });
	await expect(join).toBeDisabled();
	await page.getByRole('textbox', { name: 'Room code from the Storyteller' }).fill('000 001');
	// No room has this code, so the page says so before anyone joins (Trevor, 2026-10-19).
	await expect(page.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await expect(join).toBeDisabled();
});

test('a typed code shows the game it opens before the phone joins', async ({
	page,
	browser
}, testInfo) => {
	// Trevor (2026-10-19): "you type in the code, and then it shows you what game you will be joining".
	const board = await startGame(page, 'Sam');
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.goto('/join');
	const preview = phone.getByTestId('room-preview');
	const join = phone.getByRole('button', { name: 'Join', exact: true });
	const before = (await preview.boundingBox())!;
	const field = phone.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.tap();
	await field.pressSequentially(code);
	await expect(preview.getByText('Trouble Brewing', { exact: true })).toBeVisible();
	await expect(preview.getByTestId('script-logo')).toHaveAttribute(
		'data-logo',
		'/data/logos/tb.webp'
	);
	await expect(preview).toContainText('8 seats, 0 taken');
	await expect(preview.getByTestId('game-storyteller')).toHaveText('Storyteller: Sam');
	// The game fills space kept for it: nothing moves.
	expect((await preview.boundingBox())!.height).toBeCloseTo(before.height, 0);
	// The code boxes sit in the middle of the page.
	const boxes = phone.locator('.code-field .box');
	const first = (await boxes.first().boundingBox())!;
	const last = (await boxes.last().boundingBox())!;
	const page_ = phone.viewportSize()!;
	expect(Math.abs((first.x + last.x + last.width) / 2 - page_.width / 2)).toBeLessThan(
		page_.width / 8
	);
	await join.tap();
	await expect(phone).toHaveURL(new RegExp(`/join/${code}$`));
	await expect(phone.getByRole('heading', { level: 1 })).toHaveText(/^Room \d{3} \d{3}$/);
	await expect(phone.getByTestId('room-storyteller')).toHaveText('Storyteller: Sam');
	await phoneContext.close();
});

test('Join game in the menu takes a typed code, with spaces, and says when no game has it', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('banner').getByRole('button', { name: 'Menu' }).tap();
	await page.getByRole('link', { name: 'Join game' }).tap();
	await expect(page).toHaveURL(/\/join$/);
	await expect(page.getByRole('heading', { name: 'Join game', level: 1 })).toBeVisible();
	const field = page.getByRole('textbox', { name: 'Room code from the Storyteller' });
	await field.fill(' 482-913 ');
	// No room has this code, so the screen says so in place and Enter doesn't leave it.
	await expect(page.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/join$/);
	await expect(field).toHaveValue('482913');
});

test('the room code goes in one box per digit, and takes no more than the code holds', async ({
	page
}) => {
	// Trevor (2026-10-18): limit entry to the code's real length, with a box for each digit.
	await page.goto('/join');
	const field = page.getByRole('textbox', { name: 'Room code from the Storyteller' });
	const boxes = page.locator('.code-field .box');
	const join = page.getByRole('button', { name: 'Join', exact: true });
	await expect(boxes).toHaveCount(6);
	await field.tap();
	await field.pressSequentially('48291');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '']);
	await expect(join).toBeDisabled();
	// Letters are dropped, and a seventh digit doesn't fit.
	await field.pressSequentially('x37');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '3']);
	await expect(field).toHaveValue('482913');
	// A full code is looked up; no room has this one.
	await expect(page.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await expect(join).toBeDisabled();
	// Backspace steps back one box.
	await field.press('Backspace');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '']);
	// A pasted code fills every box, spaces and all.
	await page.getByRole('button', { name: 'Clear' }).tap();
	await expect(boxes).toHaveText(['', '', '', '', '', '']);
	await field.focus();
	await field.fill('482 913');
	await expect(boxes).toHaveText(['4', '8', '2', '9', '1', '3']);
	// The boxes fit beside each other on a phone, and the X sits after the last one.
	const last = (await boxes.last().boundingBox())!;
	const clear = (await page.getByRole('button', { name: 'Clear' }).boundingBox())!;
	expect(clear.x).toBeGreaterThanOrEqual(last.x + last.width - 1);
	expect(
		new Set(await boxes.evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().top))))
			.size
	).toBe(1);
});

test('the Worker refuses bad room requests', async ({ request }) => {
	expect((await request.get('/api/room/ABCDEF')).status()).toBe(400);
	expect((await request.post('/api/rooms', { data: { hostKeyHash: 'nope' } })).status()).toBe(400);
	expect((await request.get('/api/rooms')).status()).toBe(405);
});

test('a room tells an app too old for it to update', async ({ page, browser }, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	// Read the code once the room is open: before that the share code isn't the room's yet.
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\D/g, '');

	// The real Worker turns away a hello in a protocol older than it accepts.
	const reply = await page.evaluate(
		(url) =>
			new Promise<string>((done) => {
				const ws = new WebSocket(url);
				ws.onopen = () =>
					ws.send(
						JSON.stringify({ type: 'hello', role: 'player', key: 'a'.repeat(64), protocol: 0 })
					);
				ws.onmessage = (event) => done(String(event.data));
			}),
		`${new URL(page.url()).origin.replace(/^http/, 'ws')}/api/room/${code}`
	);
	expect(JSON.parse(reply)).toEqual({ type: 'refused', reason: 'too-old' });

	// A phone told so says what to do instead of "closed or wrong".
	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await phone.routeWebSocket(/\/api\/room\//, (ws) => {
		ws.onMessage(() => ws.send(JSON.stringify({ type: 'refused', reason: 'too-old' })));
	});
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('alert')).toHaveText(
		`This room needs a newer version of ${APP_NAME}. Refresh to update, then try again.`
	);
	await phoneContext.close();
});

test('a spectator watches the whole grimoire through the view-only link, after promising', async ({
	page,
	browser
}, testInfo) => {
	// Specters (Trevor, 2026-10-18): spectators see the Storyteller's grimoire live, through a
	// link the Storyteller turns on and off, after promising not to spoil the game.
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const watch = page.getByTestId('watch-link');
	const toggle = watch.getByRole('checkbox', { name: 'View-only grimoire link' });
	// The switch is tapped by its label, as the whole row is one tap target.
	const flip = () => watch.getByText('View-only grimoire link', { exact: true }).tap();
	const url = watch.getByTestId('share-url');
	// Off until turned on, with its place kept.
	await expect(toggle).not.toBeChecked();
	await expect(url).toHaveValue('');
	await flip();
	// The key is in the hash, which never reaches the server.
	await expect(url).toHaveValue(/\/watch\/\d{6}#[0-9a-f]{64}$/);
	const link = await url.inputValue();
	// Its QR carries the script's logo, like the join QR, and says it shows spoilers so no
	// player scans it by mistake (Trevor, 2026-10-19).
	const qr = watch.getByRole('img', { name: 'QR code to watch the grimoire' });
	await expect(qr.getByTestId('script-logo')).toHaveAttribute('data-logo', '/data/logos/tb.webp');
	await expect(qr.getByTestId('qr-caption')).toHaveText('Spoilers');

	const viewerContext = await browser.newContext({ ...testInfo.project.use });
	const viewer = await viewerContext.newPage();
	await viewer.goto(link);
	const pledge = viewer.getByRole('alertdialog', { name: 'Before you watch' });
	await expect(pledge.getByTestId('watch-pledge').getByRole('listitem')).toHaveCount(3);
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(viewer.getByRole('button', { name: /^Seat 1:/ })).toBeVisible();
	// Every control that changes the game is there but disabled (Trevor, 2026-10-19), so
	// nothing invites a try; what only reads still opens. The board says it is view-only.
	const toolbar = viewer.getByRole('toolbar', { name: 'Grimoire' });
	await expect(toolbar.getByTestId('view-only')).toHaveText('View-Only');
	for (const name of ['Day', 'Info tokens', 'Share', 'More'])
		await expect(toolbar.getByRole('button', { name, exact: true })).toBeDisabled();
	await expect(toolbar.getByRole('button', { name: 'Script', exact: true })).toBeEnabled();
	const timer = viewer.getByTestId('day-timer');
	await expect(timer).toBeVisible();
	for (const button of await timer.getByRole('button').all()) await expect(button).toBeDisabled();
	await viewer.getByRole('button', { name: /^Seat 1:/ }).tap();
	await expect(
		viewer.locator(
			'[data-part="content"][data-state="open"]:is([data-scope="dialog"], [data-scope="drawer"])'
		)
	).toHaveCount(0);
	await expect(viewer.getByText('Only the Storyteller can change this game.')).toHaveCount(0);
	// Game info, from the corner where it shows, has no pencil for a viewer.
	const corner = viewer.getByTestId('mode-menu');
	if (await corner.isVisible()) {
		await corner.tap();
		await expect(viewer.getByRole('dialog', { name: 'Game info', exact: true })).toBeVisible();
		await expect(viewer.getByTestId('game-info-edit')).toHaveCount(0);
		await viewer.keyboard.press('Escape');
	}

	// The Storyteller's changes show live.
	await page.goto(board);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill('Alex');
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await expect(viewer.getByRole('button', { name: /^Seat 1: Alex/ })).toBeVisible();

	// The viewer's timer follows the Storyteller's (Trevor, 2026-10-19).
	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	const watched = viewer.getByTestId('day-timer');
	await expect(watched).not.toHaveAttribute('data-running');
	await page.getByTestId('day-timer').getByRole('button', { name: 'Start timer' }).tap();
	await expect(watched).toHaveAttribute('data-running', '');
	const clock = watched.getByRole('timer');
	const first = await clock.textContent();
	await expect(clock).not.toHaveText(first ?? '');
	await page.getByTestId('day-timer').getByRole('button', { name: 'Pause timer' }).tap();
	await expect(watched).not.toHaveAttribute('data-running');
	await expect(clock).toHaveText(
		(await page.getByTestId('day-timer').getByRole('timer').textContent()) ?? ''
	);

	// A seat opens its character to read, never the seat sheet.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await sheet.getByRole('button', { name: 'Choose character' }).first().tap();
	await page
		.getByRole('dialog', { name: /^Character for / })
		.getByRole('button', { name: 'Washerwoman', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(viewer.getByRole('button', { name: /^Seat 1: Alex.*Washerwoman/ })).toBeVisible();
	await viewer.getByRole('button', { name: /^Seat 1:/ }).tap();
	await expect(viewer.getByRole('dialog', { name: 'Washerwoman' })).toBeVisible();
	await expect(
		viewer.locator('[data-scope="drawer"][data-part="content"][data-state="open"]')
	).toHaveCount(0);
	await viewer.keyboard.press('Escape');

	// Every open asks again.
	await viewer.reload();
	await expect(pledge).toBeVisible();
	await pledge.getByRole('button', { name: 'Confirm' }).tap();
	await expect(viewer.getByRole('button', { name: /^Seat 1: Alex/ })).toBeVisible();

	// Turning it off takes the grimoire away at once; turning it on again makes a new link.
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await flip();
	await expect(url).toHaveValue('');
	await expect(viewer.getByRole('alert')).toHaveText('The Storyteller has turned this link off.');
	await expect(viewer.getByRole('button', { name: /^Seat 1:/ })).toHaveCount(0);
	await flip();
	await expect(url).toHaveValue(/#[0-9a-f]{64}$/);
	expect(await url.inputValue()).not.toBe(link);
	await viewerContext.close();
});

test('a view-only link cut short says so and connects to nothing', async ({ page }) => {
	await page.goto('/watch/123456');
	await expect(page.getByRole('alert')).toHaveText(
		'This link is incomplete. Ask the Storyteller for it again.'
	);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
