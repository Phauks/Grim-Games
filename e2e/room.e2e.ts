import { expect, test, type Page } from '@playwright/test';

// Players' phones in a live room (07-accounts-and-multi-device.md §4.2): a phone asks for a
// seat and name, the Storyteller approves, and the seat is named in the grimoire.

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	return new URL(page.url()).pathname;
}

test('a phone joins, asks for a seat, and the Storyteller seats it', async ({
	page,
	browser
}, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await page.getByRole('button', { name: 'Open a room' }).tap();
	const code = (await page.getByTestId('room-code').textContent())!.replace(/\s/g, '');
	expect(code).toMatch(/^\d{6}$/);
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

	// Approving named the seat on the board, as an ordinary change.
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await expect(page.locator('[data-testid="seat"][aria-label^="Seat 3: Alex"]')).toBeVisible();

	// Closing the room sends the phone back to the code form.
	await page.goto(`${board}/room`);
	await page.getByRole('button', { name: 'Close room' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Close room' }).tap();
	await expect(page.getByRole('button', { name: 'Open a room' })).toBeVisible();
	await expect(phone.getByRole('alert')).toHaveText('This room is closed, or the code is wrong.');
	await phoneContext.close();
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
	await join.tap();
	await expect(page).toHaveURL(/\/join\/000001$/);
});

test('the Worker refuses bad room requests', async ({ request }) => {
	expect((await request.get('/api/room/ABCDEF')).status()).toBe(400);
	expect((await request.post('/api/rooms', { data: { hostKeyHash: 'nope' } })).status()).toBe(400);
	expect((await request.get('/api/rooms')).status()).toBe(405);
});

test('a room tells an app too old for it to update', async ({ page, browser }, testInfo) => {
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await page.getByRole('button', { name: 'Open a room' }).tap();
	const code = (await page.getByTestId('room-code').textContent())!.replace(/\D/g, '');

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
		'This room needs a newer version of Grim-Games. Refresh to update, then try again.'
	);
	await phoneContext.close();
});
