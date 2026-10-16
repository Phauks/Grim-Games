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

test('the footer has the logo on the left and every text link on the right', async ({ page }) => {
	await page.goto('/');
	const build = page.getByTestId('build-info');
	await expect(build.getByRole('link', { name: 'Report an issue' })).toBeVisible();
	const logo = await page.getByRole('img', { name: /Community Created Content/ }).boundingBox();
	const links = await build.boundingBox();
	const width = page.viewportSize()!.width;
	expect(logo!.x).toBeLessThan(width / 4);
	// The links end at the right edge, whether or not they wrap below the logo.
	expect(links!.x + links!.width).toBeGreaterThan(width * 0.9);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
});

test('the commit is a link and About opens Settings without moving the page', async ({ page }) => {
	await page.goto('/');
	const build = page.getByTestId('build-info');
	const commit = build.getByRole('link', { name: /^[0-9a-f]{7}$/ });
	expect(await commit.getAttribute('href')).toMatch(/\/commit\/[0-9a-f]{40}$/);

	// Measure once web fonts have swapped in, so only the dialog could move the footer.
	await page.evaluate(() => document.fonts.ready);
	await page.waitForLoadState('load');
	// The footer can be below the fold; tapping would scroll it, which is not the dialog's doing.
	await build.scrollIntoViewIfNeeded();
	const before = await build.boundingBox();
	await build.getByRole('button', { name: 'About' }).tap();
	// About is a Settings section (Trevor, 2026-10-16).
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog.getByRole('heading', { name: 'About' })).toBeVisible();
	await expect(dialog).toContainText('Version');
	expect(await build.boundingBox()).toEqual(before);
	await dialog.getByRole('button', { name: 'Close' }).first().tap();
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

test('the footer links to the changelog page, which is empty until 1.0', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('contentinfo').getByRole('link', { name: 'Changelog' }).tap();
	await expect(page).toHaveURL(/\/changelog$/);
	await expect(page.getByRole('heading', { name: 'Changelog', level: 1 })).toBeVisible();
	const main = page.getByRole('main');
	await expect(main.getByRole('heading', { name: 'Unreleased', level: 2 })).toBeVisible();
	for (const category of ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'])
		await expect(main.getByRole('heading', { name: category, level: 3 })).toBeVisible();
	await expect(main.getByText('None', { exact: true })).toHaveCount(6);
});

test('the footer links to the privacy policy page', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).tap();
	await expect(page).toHaveURL(/\/privacy$/);
	await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
});

test('the footer never makes the page wider than the screen, even at the largest text size', async ({
	page
}) => {
	await page.goto('/');
	await page.evaluate(() =>
		localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ textScale: 1.5 }))
	);
	await page.reload();
	await page.evaluate(() => document.fonts.ready);
	const widths = await page.evaluate(() => ({
		page: document.documentElement.scrollWidth,
		screen: window.innerWidth
	}));
	expect(widths.page).toBeLessThanOrEqual(widths.screen);
});

test('About in Settings links to the Diagnostics page', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	await page.getByRole('contentinfo').getByRole('button', { name: 'About' }).tap();
	await page
		.getByRole('dialog', { name: 'Settings' })
		.getByRole('link', { name: 'Diagnostics' })
		.tap();
	await expect(page).toHaveURL(/\/diagnostics$/);
	await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

// Turned on by the board's +layout.ts ({ chrome: 'game' }); the board's toolbar opens the
// app menu, and leaving asks first (src/lib/features/shell/shell.ts).
test('a game in progress hides the header and footer, so a stray tap cannot leave it', async ({
	page
}) => {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await expect(page.getByRole('banner')).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);

	// Setting up a game is not "in progress": the header is back there.
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await expect(page.getByRole('banner').getByRole('link', { name: 'Grim-Games' })).toBeVisible();
});
