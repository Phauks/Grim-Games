import { expect, test } from '@playwright/test';

// Trevor (2026-10-16): New game, Resume game, Scripts and the other destinations in a left
// sidebar reachable from every part of the app; a drawer on phones.

test('on a phone, the header menu opens a drawer with every destination', async ({ page }) => {
	test.skip(test.info().project.name !== 'phone', 'phone layout');
	await page.goto('/');
	const menu = page.getByRole('banner').getByRole('button', { name: 'Menu' });
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	await menu.tap();
	const drawer = page.getByRole('dialog', { name: 'Menu' });
	await expect(drawer).toBeVisible();
	// The hamburger in the same spot closes it again.
	await drawer.getByRole('button', { name: 'Close menu' }).first().tap();
	await expect(drawer).toBeHidden();
	await menu.tap();
	for (const name of [
		'Home',
		'New game',
		'Resume game',
		'History',
		'Scripts',
		'Library',
		'Script builder',
		'Player view',
		'Character reference',
		'Info tokens',
		'Account'
	]) {
		await expect(drawer.getByRole('link', { name })).toBeVisible();
	}
	// Grouped under plain labels: games, preparation, players, then you (Trevor, 2026-10-16).
	await expect(drawer.getByRole('heading')).toHaveText([
		'Menu',
		'Games',
		'Prepare',
		'Players',
		'You'
	]);
	// Home stands first on its own, outside the groups (Trevor, 2026-10-16).
	await expect(drawer.getByRole('link').first()).toHaveText('Home');
	await expect(drawer.getByRole('list', { name: 'Games' }).getByRole('link')).toHaveText([
		'New game',
		'Resume game',
		'History'
	]);
	await expect(drawer.getByRole('list', { name: 'Prepare' }).getByRole('link')).toHaveText([
		'Scripts',
		'Library',
		'Script builder',
		'Info tokens',
		'Character reference'
	]);
	await drawer.getByRole('link', { name: 'Scripts' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await expect(drawer).toBeHidden();

	await menu.tap();
	await expect(drawer.getByRole('link', { name: 'Scripts' })).toHaveAttribute(
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
		const menu = page.getByRole('banner').getByRole('button', { name: 'Menu' });
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
		await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
	});
});
