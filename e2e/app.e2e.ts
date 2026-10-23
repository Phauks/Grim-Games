import { expect, test } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { menuButton, openSettingsDialog, theMenu } from './shell.ts';

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

/** The menu: the sidebar where it shows, else the drawer, opened. */
// No footer (2026-10-23): its pages, Report an issue and the build line moved to the end of the
// menu, the build line just above the CCC logo (Trevor's pick: the menu's bottom).
test('the menu ends with App, the build line and the CCC logo; there is no footer', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('contentinfo')).toHaveCount(0);
	const menu = await theMenu(page);
	await expect(menu.getByRole('list', { name: 'App', exact: true }).getByRole('link')).toHaveText([
		'About',
		'Changelog',
		'Roadmap',
		'Privacy'
	]);
	const build = menu.getByTestId('build-info');
	await expect(build).toContainText(/v\d+\.\d+\.\d+ · [0-9a-f]{7}/);
	const commit = build.getByRole('link', { name: /^[0-9a-f]{7}$/ });
	expect(await commit.getAttribute('href')).toMatch(/\/commit\/[0-9a-f]{40}$/);
	// The Community Created Content logo is last (Trevor, 2026-10-17 and 2026-10-22).
	const logo = menu.getByRole('img', { name: /Community Created Content/ });
	await expect(logo).toBeVisible();
	await expect
		.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
		.toBeGreaterThan(0);
	expect((await logo.boundingBox())!.y).toBeGreaterThan((await build.boundingBox())!.y);

	await menu.getByRole('button', { name: 'Report an issue' }).tap();
	await expect(page.getByRole('dialog', { name: 'Report' })).toBeVisible();
});

// Trevor (2026-10-19): a link switches between the beta and production builds. A local build
// has no other build to open, so it shows none; build-switch.test.ts covers the hosts.
test('a local build shows no switch to beta or production', async ({ page }) => {
	await page.goto('/');
	const menu = await theMenu(page);
	await expect(menu.getByTestId('build-info')).toBeVisible();
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

test('the menu links the changelog page, which lists merged changes by day', async ({ page }) => {
	await page.goto('/');
	await (await theMenu(page)).getByRole('link', { name: 'Changelog' }).tap();
	await expect(page).toHaveURL(/\/changelog$/);
	await expect(page.getByRole('heading', { name: 'Changelog', level: 1 })).toBeVisible();
	const main = page.getByRole('main');
	await expect(main.getByRole('heading', { name: 'Unreleased', level: 2 })).toBeVisible();
	// Each change opens its PR or commit on GitHub, under the day it landed.
	await expect(main.getByRole('heading', { level: 3 }).first()).toBeVisible();
	const change = main.getByTestId('update-changes').getByRole('link').first();
	await expect(change).toHaveAttribute('href', /^https:\/\/github\.com\/Phauks\/Grim-Games\//);
	// A line between changes, none above the first.
	const rows = main.getByTestId('update-changes').first().getByRole('listitem');
	await expect(rows.first()).toHaveCSS('border-top-width', '0px');
	if ((await rows.count()) > 1) await expect(rows.nth(1)).not.toHaveCSS('border-top-width', '0px');
});

test('the menu links the roadmap, which lists planned items by area', async ({ page }) => {
	await page.goto('/');
	await (await theMenu(page)).getByRole('link', { name: 'Roadmap' }).tap();
	await expect(page).toHaveURL(/\/roadmap$/);
	await expect(page.getByRole('heading', { name: 'Roadmap', level: 1 })).toBeVisible();
	const main = page.getByRole('main');
	await expect(main.getByRole('heading', { name: 'Rooms and sharing', level: 2 })).toBeVisible();
	await expect(main.getByTestId('roadmap-item').first()).toContainText('D1');
	// Done items link the change that finished them; CI's one-commit history has none.
	for (const done of await main.locator('[data-testid="roadmap-item"][data-done] a').all())
		await expect(done).toHaveAttribute('href', /^https:\/\/github\.com\/Phauks\/Grim-Games\//);
});

test('the menu links the privacy policy page', async ({ page }) => {
	await page.goto('/');
	await (await theMenu(page)).getByRole('link', { name: 'Privacy' }).tap();
	await expect(page).toHaveURL(/\/privacy$/);
	await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
});

// Trevor (2026-10-20): every notice that the app is not official links the official site.
test("the 'not official' notice links the official site, in About and the privacy policy", async ({
	page
}) => {
	const official = 'https://bloodontheclocktower.com';
	await page.goto('/privacy');
	await expect(
		page.getByRole('main').getByRole('link', { name: 'Blood on the Clocktower', exact: true })
	).toHaveAttribute('href', official);

	await page.goto('/about');
	const notice = page.getByRole('main').locator('.official-notice');
	await expect(notice).toContainText('Not affiliated with The Pandemonium Institute.');
	await expect(
		notice.getByRole('link', { name: 'Blood on the Clocktower', exact: true })
	).toHaveAttribute('href', official);
});

// About is its own page in the menu, not a Settings section, since it holds no settings
// (2026-10-23). Diagnostics stays its Advanced part, closed until opened (Trevor, 2026-10-18).
test('About is a page in the menu with Diagnostics closed under it; /diagnostics opens it', async ({
	page
}) => {
	await page.goto('/');
	await (await theMenu(page)).getByRole('link', { name: 'About' }).tap();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
	const main = page.getByRole('main');
	const advanced = main.getByRole('button', { name: 'Advanced' });
	await expect(advanced).toHaveAttribute('aria-expanded', 'false');
	await expect(main.getByTestId('diagnostics')).toBeHidden();
	await advanced.tap();
	await expect(main.getByTestId('diagnostics')).toBeVisible();
	await advanced.tap();

	// Settings no longer lists About.
	const settings = await openSettingsDialog(page);
	await expect(
		settings
			.getByRole('navigation', { name: 'Settings sections' })
			.getByRole('button', { name: 'About' })
	).toHaveCount(0);

	// The old page address opens About with Advanced open.
	await page.goto('/diagnostics');
	await expect(page).toHaveURL(/\/about$/);
	await expect(main.getByTestId('diagnostics')).toBeVisible();
	await expect(advanced).toHaveAttribute('aria-expanded', 'true');
});

// Turned on by the board's +layout.ts ({ chrome: 'game' }); the board's toolbar opens the
// app menu, and leaving asks first (src/lib/features/shell/shell.ts).
test('a game in progress hides the sidebar, so a stray tap cannot leave it', async ({ page }) => {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.locator('.app-body.bare')).toHaveCount(1);

	// Character setup is part of the game too (Trevor, 2026-10-23): no sidebar or menu there.
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
	await expect(page.locator('.app-body.bare')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveCount(0);
});

// Trevor (2026-10-19): the phone's top and bottom bars match the palette. The page draws under
// them (viewport-fit=cover) and the status bar takes the surface colour, in every theme. With no
// app header (2026-10-22), a strip of that colour stays under the status bar as the page scrolls.
test("the phone's bars follow the surface colour, custom colours included", async ({ page }) => {
	const hex = (rgb: string) =>
		'#' +
		(rgb.match(/\d+/g) ?? [])
			.slice(0, 3)
			.map((n) => Number(n).toString(16).padStart(2, '0'))
			.join('');
	const barColours = () =>
		page.evaluate(() => ({
			meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
			header: getComputedStyle(document.querySelector('.app-body')!, '::before').backgroundColor
		}));

	await page.goto('/');
	await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
		'content',
		/viewport-fit=cover/
	);
	await expect(menuButton(page)).toBeVisible();
	const before = await barColours();
	expect(before.meta).toBe(hex(before.header));

	await page.evaluate(() =>
		localStorage.setItem(
			'grim-games:preferences:v1',
			JSON.stringify({ colors: { '--surface': '#203040' } })
		)
	);
	await page.reload();
	await expect(menuButton(page)).toBeVisible();
	const after = await barColours();
	expect(after.meta).toBe('#203040');
	expect(hex(after.header)).toBe('#203040');
});

// Trevor (2026-10-19): on an iPhone the bars stayed flat --surface on the board, because a
// home-screen app paints the body's fixed background only between them.
test("the theme's backdrop is a fixed layer that reaches under the phone's bars", async ({
	page
}) => {
	await page.goto('/');
	await expect(menuButton(page)).toBeVisible();
	const looks = await page.evaluate(() => {
		const layer = getComputedStyle(document.body, '::before');
		return {
			body: getComputedStyle(document.body).backgroundImage,
			position: layer.position,
			image: layer.backgroundImage,
			zIndex: layer.zIndex,
			height: parseFloat(layer.height)
		};
	});
	expect(looks.body).toBe('none');
	expect(looks.position).toBe('fixed');
	expect(looks.image).toMatch(/gradient/);
	expect(looks.zIndex).toBe('-1');
	expect(looks.height).toBeGreaterThanOrEqual(page.viewportSize()!.height);
});

// Trevor (2026-10-19, on a Pixel): the bars (flat theme-color) stood apart from the backdrop.
// With no header or footer on any screen, every backdrop fades to --surface at the top and bottom.
test("every screen's backdrop fades into the phone's bars", async ({ page }) => {
	const layer = () =>
		page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
	const surface = () =>
		page.evaluate(() => {
			const probe = document.createElement('i');
			probe.style.color = 'var(--surface)';
			document.body.append(probe);
			const colour = getComputedStyle(probe).color;
			probe.remove();
			return colour;
		});
	await page.goto('/');
	await expect(menuButton(page)).toBeVisible();
	expect((await layer()).match(/linear-gradient/g)).toHaveLength(2);
	expect(await layer()).toContain(await surface());

	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await expect(page.locator('.app-body.bare')).toBeVisible();
	const image = await layer();
	expect(image.match(/linear-gradient/g)).toHaveLength(2);
	expect(image).toContain(await surface());
	expect(image).toMatch(/radial-gradient/);
});
