import { expect, test } from '@playwright/test';

// Trevor (2026-10-16): New game, Resume game, Scripts and the other destinations in a left
// sidebar reachable from every part of the app; a drawer on phones.

test('on a phone, the header menu opens a drawer with every destination', async ({ page }) => {
	test.skip(test.info().project.name !== 'phone', 'phone layout');
	await page.goto('/');
	await page.getByRole('banner').getByRole('button', { name: 'Open menu' }).tap();
	const drawer = page.getByRole('dialog', { name: 'Menu' });
	await expect(drawer).toBeVisible();
	for (const name of [
		'New game',
		'Resume game',
		'Scripts',
		'Player view',
		'Character reference',
		'Info tokens',
		'Account'
	]) {
		await expect(drawer.getByRole('link', { name })).toBeVisible();
	}
	await drawer.getByRole('link', { name: 'Scripts' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await expect(drawer).toBeHidden();

	await page.getByRole('banner').getByRole('button', { name: 'Open menu' }).tap();
	await expect(drawer.getByRole('link', { name: 'Scripts' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await drawer.getByRole('button', { name: 'Settings' }).tap();
	await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

test.describe('on a computer', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('the sidebar stays beside every page and collapses to icons', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/privacy');
		const nav = page.getByRole('navigation', { name: 'Menu' });
		await expect(nav).toBeVisible();
		await expect(page.getByRole('banner').getByRole('button', { name: 'Open menu' })).toBeHidden();

		await nav.getByRole('link', { name: 'Character reference' }).click();
		await expect(page).toHaveURL(/\/reference$/);
		await expect(nav.getByRole('link', { name: 'Character reference' })).toHaveAttribute(
			'aria-current',
			'page'
		);

		const wide = (await nav.boundingBox())!.width;
		await nav.getByRole('button', { name: 'Collapse menu' }).click();
		expect((await nav.boundingBox())!.width).toBeLessThan(wide / 2);
		// Names stay available as accessible names and tooltips.
		await expect(nav.getByRole('link', { name: 'Scripts' })).toHaveAttribute('title', 'Scripts');
		await page.reload();
		await expect(nav.getByRole('button', { name: 'Expand menu' })).toBeVisible();
	});
});
