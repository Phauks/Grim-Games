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

/** The menu: the sidebar when it shows, else the drawer, opened. */
export async function theMenu(page: Page) {
	// Once the page is up, so a sidebar still on its way isn't mistaken for none.
	await expect(menuButton(page)).toBeVisible();
	const sidebar = page.getByRole('navigation', { name: 'Menu', exact: true }).filter({
		visible: true
	});
	return (await sidebar.count()) ? sidebar : openMenu(page);
}

/** Opens Settings from the menu. */
export async function openSettingsDialog(page: Page) {
	const nav = await theMenu(page);
	const settings = nav.getByRole('button', { name: 'Settings', exact: true });
	if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) await settings.tap();
	else await settings.click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();
	return dialog;
}

/**
 * Every screen has a way back (Trevor, 2026-10-26): the hamburger, or a game or start-flow
 * screen's own Back. The browser's and phone's back never count: the installed iPhone app has
 * none on screen. The controls that count carry `data-way-back`; one must show, ready to tap.
 */
export async function expectWayBack(page: Page) {
	const ways = page.locator('[data-way-back]').filter({ visible: true });
	await expect(ways.first()).toBeVisible();
	await expect
		.poll(() => ways.evaluateAll((all) => all.some((el) => !el.matches(':disabled'))))
		.toBe(true);
}
