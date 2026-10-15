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
	await expect
		.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
		.toBeGreaterThan(0);
});

test('the commit is a link and About opens a dialog without moving the page', async ({ page }) => {
	await page.goto('/');
	const build = page.getByTestId('build-info');
	const commit = build.getByRole('link', { name: /^[0-9a-f]{7}$/ });
	expect(await commit.getAttribute('href')).toMatch(/\/commit\/[0-9a-f]{40}$/);

	// Measure once web fonts have swapped in, so only the dialog could move the footer.
	await page.evaluate(() => document.fonts.ready);
	await page.waitForLoadState('load');
	const before = await build.boundingBox();
	await build.getByRole('button', { name: 'About' }).tap();
	const dialog = page.getByRole('dialog', { name: 'About Grim-Games' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Channel');
	expect(await build.boundingBox()).toEqual(before);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
});

test('installs as a PWA and reopens offline', async ({ page, context }) => {
	const manifest = await (await page.request.get('/manifest.webmanifest')).json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	await context.setOffline(true);
	await page.goto('/sheet/tb/washerwoman');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await context.setOffline(false);
});

test('the footer sits at the bottom of the screen on a short page', async ({ page }) => {
	await page.goto('/');
	const footer = page.getByRole('contentinfo');
	await expect(footer).toBeVisible();
	const box = await footer.boundingBox();
	const height = await page.evaluate(() => document.documentElement.scrollHeight);
	const viewport = page.viewportSize()!.height;
	// Either the page is short and the footer touches the bottom of the screen, or the page
	// scrolls and the footer ends the document.
	expect(Math.round(box!.y + box!.height)).toBe(Math.max(viewport, height));
});
