import { expect, test } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';

test('home page renders on a touch device', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
	// Blank until near 1.0, and it says so (Trevor, 2026-10-17).
	await expect(
		page.getByRole('main').getByText('This page is intentionally blank', { exact: true })
	).toBeVisible();
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

test('every page shows build info and a Report an issue button for the in-app form', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByTestId('build-info')).toContainText(/v\d+\.\d+\.\d+ · [0-9a-f]{7}/);
	await page.getByTestId('build-info').getByRole('button', { name: 'Report an issue' }).tap();
	await expect(page.getByRole('dialog', { name: 'Report' })).toBeVisible();
});

// Trevor (2026-10-17): the Community Created Content logo sits at the bottom of the menu, not
// in every page's footer (TPI's policy only asks that it is shown clearly).
test('the Community Created Content logo is at the bottom of the menu', async ({ page }) => {
	await page.goto('/');
	await expect(
		page.getByRole('contentinfo').getByRole('img', { name: /Community Created Content/ })
	).toHaveCount(0);
	const sidebar = page.getByRole('navigation', { name: 'Menu' }).first();
	const drawer = page.getByRole('dialog', { name: APP_NAME });
	let menu = sidebar;
	if (!(await sidebar.isVisible())) {
		await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
		menu = drawer;
	}
	const logo = menu.getByRole('img', { name: /Community Created Content/ });
	await expect(logo).toBeVisible();
	await expect
		.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
		.toBeGreaterThan(0);
	// Below every menu link.
	const links = await menu.getByRole('link').all();
	const last = (await links[links.length - 2].boundingBox())!;
	expect((await logo.boundingBox())!.y).toBeGreaterThan(last.y);
});

test('the footer has every text link on the right', async ({ page }) => {
	await page.goto('/');
	const build = page.getByTestId('build-info');
	await expect(build.getByRole('button', { name: 'Report an issue' })).toBeVisible();
	const links = await build.boundingBox();
	const width = page.viewportSize()!.width;
	// The links end at the right edge, whether or not they wrap.
	expect(links!.x + links!.width).toBeGreaterThan(width * 0.9);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
});

test('the commit is a link; About is in Settings, not the footer', async ({ page }) => {
	await page.goto('/');
	const build = page.getByTestId('build-info');
	const commit = build.getByRole('link', { name: /^[0-9a-f]{7}$/ });
	expect(await commit.getAttribute('href')).toMatch(/\/commit\/[0-9a-f]{40}$/);
	// Trevor (2026-10-18): "remove about from footer, access from settings only".
	await expect(page.getByRole('contentinfo').getByRole('button', { name: 'About' })).toHaveCount(0);
	await expect(build.getByRole('link', { name: 'Changelog' })).toBeVisible();
	await expect(build.getByRole('link', { name: 'Privacy' })).toBeVisible();
	await expect(build.getByRole('button', { name: 'Report an issue' })).toBeVisible();
});

// Trevor (2026-10-19): a footer button switches between the beta and production builds. A local
// build has no other build to open, so it shows none; build-switch.test.ts covers the hosts.
test('a local build shows no switch to beta or production', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('build-info')).toBeVisible();
	await expect(page.getByTestId('switch-build')).toHaveCount(0);
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

// Trevor (2026-10-18): Diagnostics is About's Advanced part, closed until opened.
test('Diagnostics is under About, closed, and its old page address opens it', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'About' })
		.tap();
	const advanced = settings.getByRole('button', { name: 'Advanced' });
	await expect(advanced).toHaveAttribute('aria-expanded', 'false');
	await expect(settings.getByTestId('diagnostics')).toBeHidden();
	await advanced.tap();
	await expect(settings.getByTestId('diagnostics')).toBeVisible();
	await advanced.tap();
	await expect(page).toHaveURL(/\/$/);

	// The old page address opens About with Advanced open; closing it goes home.
	await page.goto('/diagnostics');
	await expect(settings.getByTestId('diagnostics')).toBeVisible();
	await expect(advanced).toHaveAttribute('aria-expanded', 'true');
	await settings.getByRole('button', { name: 'Close' }).first().tap();
	await expect(page).toHaveURL(/\/$/);
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
	await expect(page.getByRole('banner').getByRole('link', { name: APP_NAME })).toBeVisible();
});
