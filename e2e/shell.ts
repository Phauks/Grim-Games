import { expect, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';

/**
 * The hamburger. There is no app header (2026-10-22): it heads the sidebar, sits before a
 * page's title while no sidebar shows (phones, tablets, a closed sidebar), and in a game's
 * toolbar. Only one shows at a time; the open drawer's own is "Close menu".
 */
export const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu', exact: true });

/** Opens the drawer from the hamburger and returns it. */
export async function openMenu(page: Page) {
	await menuButton(page).tap();
	const drawer = page.getByRole('dialog', { name: APP_NAME });
	await expect(drawer).toBeVisible();
	return drawer;
}

/** Opens Settings from the menu: the sidebar's when it shows, else the drawer's. */
export async function openSettingsDialog(page: Page) {
	// Once the page is up, so a sidebar still on its way isn't mistaken for none.
	await expect(menuButton(page)).toBeVisible();
	const sidebar = page.getByRole('navigation', { name: 'Menu', exact: true }).filter({
		visible: true
	});
	const nav = (await sidebar.count()) ? sidebar : await openMenu(page);
	const settings = nav.getByRole('button', { name: 'Settings', exact: true });
	if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) await settings.tap();
	else await settings.click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();
	return dialog;
}
