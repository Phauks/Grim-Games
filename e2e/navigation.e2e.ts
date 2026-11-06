import { expect, test } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { menuButton } from './shell.ts';

// Trevor (2026-10-16): New game, Join game, Scripts and the other destinations in a left
// sidebar reachable from every part of the app; a drawer on phones.

test('on a phone, the header menu opens a drawer with every destination', async ({ page }) => {
	test.skip(test.info().project.name !== 'phone', 'phone layout');
	await page.goto('/');
	const menu = menuButton(page);
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	await menu.tap();
	const drawer = page.getByRole('dialog', { name: APP_NAME });
	await expect(drawer).toBeVisible();
	// The hamburger in the same spot closes it again.
	await drawer.getByRole('button', { name: 'Close menu' }).first().tap();
	await expect(drawer).toBeHidden();
	await menu.tap();
	for (const name of [
		'Home',
		'New game',
		'Join game',
		'History',
		'Search',
		'Library',
		'Script builder',
		'Character builder',
		'Mode builder',
		'Info tokens',
		'Character Analyzer',
		'Account'
	]) {
		await expect(drawer.getByRole('link', { name })).toBeVisible();
	}
	// Grouped under plain labels: games, preparation, you, then the app's own pages (Trevor,
	// 2026-10-16; no Player view, 2026-10-19; the footer's pages, 2026-10-23).
	// Headed with the app's name, not "Menu" (Trevor, 2026-10-18).
	// The builders have their own section after Prepare (Trevor, 2026-10-31), headed Create
	// (Trevor, 2026-11-01).
	await expect(drawer.getByRole('heading')).toHaveText([
		APP_NAME,
		'Play',
		'Prepare',
		'Create',
		'You',
		'App'
	]);
	// Home stands first on its own, outside the groups (Trevor, 2026-10-16).
	await expect(drawer.getByRole('link').first()).toHaveText('Home');
	await expect(
		drawer.getByRole('list', { name: 'Play', exact: true }).getByRole('link')
	).toHaveText(['New game', 'Join game']);
	// History sits under You with Account and Friends (Trevor, 2026-10-29).
	await expect(drawer.getByRole('list', { name: 'You', exact: true }).getByRole('link')).toHaveText(
		['Account', 'Friends', 'History']
	);
	await expect(drawer.getByRole('list', { name: 'Prepare' }).getByRole('link')).toHaveText([
		'Search',
		'Library'
	]);
	await expect(drawer.getByRole('list', { name: 'Create' }).getByRole('link')).toHaveText([
		'Script builder',
		'Character builder',
		'Mode builder',
		'Info tokens',
		'Character Analyzer'
	]);
	await drawer.getByRole('link', { name: 'Search' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await expect(drawer).toBeHidden();

	await menu.tap();
	await expect(drawer.getByRole('link', { name: 'Search' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await drawer.getByRole('button', { name: 'Settings' }).tap();
	await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

test.describe('on a computer', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('the sidebar stays beside every page, and the hamburger closes and opens it', async ({
		page
	}) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/privacy');
		const nav = page.getByRole('navigation', { name: 'Menu' });
		const menu = menuButton(page);
		await expect(nav).toBeVisible();
		await expect(menu).toHaveAttribute('aria-expanded', 'true');

		await nav.getByRole('link', { name: 'Character Analyzer' }).click();
		await expect(page).toHaveURL(/\/character-analyzer$/);
		await expect(nav.getByRole('link', { name: 'Character Analyzer' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		await menu.click();
		await expect(nav).toBeHidden();
		await expect(menu).toHaveAttribute('aria-expanded', 'false');
		// Remembered on the device; no drawer opens on a wide screen.
		await page.reload();
		await expect(nav).toBeHidden();
		await menu.click();
		await expect(nav).toBeVisible();
		await expect(page.getByRole('dialog', { name: APP_NAME })).toHaveCount(0);
	});

	// Trevor (2026-10-29): "items in the left sidebar should be collapsible". Each section closes
	// from its heading, says how many items it holds while closed, and stays closed after a reload.
	test('each sidebar section opens and closes from its heading, remembered', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/privacy');
		const nav = page.getByRole('navigation', { name: 'Menu' });
		const prepare = nav.getByRole('button', { name: 'Prepare' });
		await expect(prepare).toHaveAttribute('aria-expanded', 'true');
		await prepare.click();
		await expect(prepare).toHaveAttribute('aria-expanded', 'false');
		await expect(nav.getByRole('link', { name: 'Library' })).toBeHidden();
		await expect(prepare.getByTestId('section-count')).toHaveText('2');
		// The other sections stay as they were.
		await expect(nav.getByRole('link', { name: 'New game' })).toBeVisible();
		await page.reload();
		await expect(prepare).toHaveAttribute('aria-expanded', 'false');
		await prepare.click();
		await expect(nav.getByRole('link', { name: 'Library' })).toBeVisible();
	});

	// Trevor (2026-10-29): "modals get buttons, locations get the current". Every menu row goes
	// to a place; Settings, Report an issue and the build switch are buttons under the sections.
	test('menu rows only go to places; actions are buttons under them', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/');
		const nav = page.getByRole('navigation', { name: 'Menu' });
		await expect(nav.getByRole('listitem').first()).toBeVisible();
		for (const item of await nav.getByRole('listitem').all()) {
			await expect(item.getByRole('button')).toHaveCount(0);
			await expect(item.getByRole('link')).toHaveCount(1);
		}
		const you = nav.getByRole('list', { name: 'You', exact: true });
		await expect(you.getByRole('link')).toHaveText(['Account', 'Friends', 'History']);
		await expect(nav.getByTestId(/^nav-action-/)).toHaveText(['Settings', 'Report an issue']);
		// A label that wraps (a larger text size) stays at the start, beside its icon (2026-11-06).
		for (const action of await nav.getByTestId(/^nav-action-/).all()) {
			await expect(action).toHaveCSS('text-align', 'start');
		}
		await nav.getByRole('button', { name: 'Report an issue' }).click();
		await expect(page.getByRole('dialog', { name: 'Report' })).toBeVisible();
	});
});

// Trevor, 2026-11-05: scrolled, the sidebar's pinned Play heading stopped below the sidebar's
// top, so New game showed above it. It now pins at the very top, with nothing above it.
test.describe('on a short computer screen', () => {
	test.use({ viewport: { width: 1280, height: 420 }, isMobile: false, hasTouch: false });

	test("the sidebar's section headings pin at its own top", async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/privacy');
		const nav = page.getByRole('navigation', { name: 'Menu' });
		const play = nav.getByRole('button', { name: 'Play', exact: true });
		await expect(play).toBeVisible();
		const scroller = nav.locator('[data-own-scroll]');
		await scroller.evaluate((box) => (box.scrollTop = 180));
		await expect
			.poll(async () => {
				const box = (await scroller.boundingBox())!;
				return (await play.boundingBox())!.y - box.y;
			})
			.toBeLessThan(1);
	});
});

// Trevor, 2026-11-06: in the phone drawer, rows showed above a pinned section heading, in
// the drawer's top padding. The drawer's body scrolls now, so the heading stops right under
// the drawer's header and nothing shows above it.
test.describe('on a short phone', () => {
	test.use({ viewport: { width: 390, height: 480 } });

	test("the drawer's section headings pin right under its header", async ({ page }) => {
		test.skip(test.info().project.name !== 'phone', 'phone layout');
		await page.goto('/privacy');
		await menuButton(page).tap();
		const drawer = page.getByRole('dialog', { name: APP_NAME });
		await expect(drawer.getByRole('button', { name: 'Prepare', exact: true })).toBeVisible();
		const body = drawer.locator('.body[data-scroll]').first();
		await body.evaluate((box) => (box.scrollTop = 400));
		// The highest heading still in view sits on the body's top edge.
		await expect
			.poll(() =>
				body.evaluate((box) => {
					const top = box.getBoundingClientRect().top;
					const heads = [...box.querySelectorAll('.collapsible[data-pinned] > .head')]
						.map((head) => head.getBoundingClientRect())
						.filter((r) => r.bottom > top + 1)
						.map((r) => r.top - top);
					return Math.abs(Math.min(...heads));
				})
			)
			.toBeLessThan(1);
	});
});
