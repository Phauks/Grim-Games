import { expect, test } from '@playwright/test';

test('home page renders on a touch device', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grim-Games');
	expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
});

test('deep links fall back to the app with HTTP 200', async ({ request }) => {
	const response = await request.get('/sheet/tb/washerwoman');
	expect(response.status()).toBe(200);
	expect(await response.text()).toContain('<html');
});

test('the Worker answers its health check and rejects bad room codes', async ({ request }) => {
	expect(await (await request.get('/api/health')).json()).toEqual({ ok: true });
	expect((await request.get('/api/room/ABCD0')).status()).toBe(400);
	expect((await request.get('/api/nope')).status()).toBe(404);
});

test('two devices in one room see the same names', async ({ page, browser }) => {
	// Rooms persist, so every run and project gets a fresh code from the room-code alphabet.
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const code = Array.from(
		{ length: 5 },
		() => alphabet[Math.floor(Math.random() * alphabet.length)]
	).join('');
	const other = await browser.newPage();
	await Promise.all([page.goto('/'), other.goto('/')]);

	const join = (args: { code: string; name: string }) =>
		new Promise<string[]>((resolve) => {
			const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/api/room/${args.code}`);
			ws.onopen = () => ws.send(JSON.stringify({ type: 'add-name', name: args.name }));
			ws.onmessage = (event) => {
				const message = JSON.parse(event.data);
				if (message.names.length === 2) resolve(message.names);
			};
		});

	const [mine, theirs] = await Promise.all([
		page.evaluate(join, { code, name: 'Trevor' }),
		other.evaluate(join, { code, name: 'Alex' })
	]);
	expect(new Set(mine)).toEqual(new Set(['Trevor', 'Alex']));
	expect(new Set(theirs)).toEqual(new Set(['Trevor', 'Alex']));
	await other.close();
});

test('every page shows build info and a prefilled report link', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('build-info')).toContainText(/v\d+\.\d+\.\d+ · [0-9a-f]{7}/);
	const href = await page.getByRole('link', { name: 'Report an issue' }).getAttribute('href');
	const url = new URL(href!);
	expect(url.pathname).toBe('/Phauks/Grim-Games/issues/new');
	expect(url.searchParams.get('template')).toBe('bug_report.yml');
	expect(url.searchParams.get('page')).toBe('/');
	expect(url.searchParams.get('build')).toMatch(/^v\d/);
});

test('the footer shows the Community Created Content logo', async ({ page }) => {
	await page.goto('/');
	const logo = page.getByRole('img', { name: /Community Created Content/ });
	await expect(logo).toBeVisible();
	expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});
