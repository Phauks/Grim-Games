import { expect, test } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { menuButton } from './shell.ts';

// Trevor (2026-10-16): New game, Continue game, Scripts and the other destinations in a left
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
		'Continue game',
		'History',
		'Search',
		'Library',
		'Script builder',
		'Character builder',
		'Character reference',
		'Info tokens',
		'Account'
	]) {
		await expect(drawer.getByRole('link', { name })).toBeVisible();
	}
	// Grouped under plain labels: games, preparation, you, then the app's own pages (Trevor,
	// 2026-10-16; no Player view, 2026-10-19; the footer's pages, 2026-10-23).
	// Headed with the app's name, not "Menu" (Trevor, 2026-10-18).
	await expect(drawer.getByRole('heading')).toHaveText([APP_NAME, 'Play', 'Prepare', 'You', 'App']);
	// Home stands first on its own, outside the groups (Trevor, 2026-10-16).
	await expect(drawer.getByRole('link').first()).toHaveText('Home');
	await expect(
		drawer.getByRole('list', { name: 'Play', exact: true }).getByRole('link')
	).toHaveText(['New game', 'Continue game']);
	// History sits under You with Account and Friends (Trevor, 2026-10-29).
	await expect(drawer.getByRole('list', { name: 'You', exact: true }).getByRole('link')).toHaveText(
		['Account', 'Friends', 'History']
	);
	await expect(drawer.getByRole('list', { name: 'Prepare' }).getByRole('link')).toHaveText([
		'Search',
		'Library',
		'Script builder',
		'Character builder',
		'Info tokens',
		'Character reference'
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

		await nav.getByRole('link', { name: 'Character reference' }).click();
		await expect(page).toHaveURL(/\/reference$/);
		await expect(nav.getByRole('link', { name: 'Character reference' })).toHaveAttribute(
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
		await expect(prepare.getByTestId('section-count')).toHaveText('6');
		// The other sections stay as they were.
		await expect(nav.getByRole('link', { name: 'New game' })).toBeVisible();
		await page.reload();
		await expect(prepare).toHaveAttribute('aria-expanded', 'false');
		await prepare.click();
		await expect(nav.getByRole('link', { name: 'Library' })).toBeVisible();
	});

	// Report an issue does something rather than go somewhere, so it is a button under the
	// sections, not a menu row (Trevor, 2026-10-29).
	test('Report an issue is a button, not a menu row', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/');
		const nav = page.getByRole('navigation', { name: 'Menu' });
		const report = nav.getByRole('button', { name: 'Report an issue' });
		await expect(nav.getByRole('listitem').filter({ has: report })).toHaveCount(0);
		await report.click();
		await expect(page.getByRole('dialog', { name: 'Report' })).toBeVisible();
	});
});
