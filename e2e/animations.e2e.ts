import { expect, test } from '@playwright/test';
import { openSettingsDialog, theMenu } from './shell.ts';

/**
 * One Animations setting for players, Storytellers and spectators alike (Trevor, 2026-11-16):
 * Match device, On or Off in Settings > Theme. While animations are off, `<html>` carries
 * `data-motion-off` and every motion token is 0ms.
 */
const off = (page: import('@playwright/test').Page) =>
	page.evaluate(() => document.documentElement.hasAttribute('data-motion-off'));
const token = (page: import('@playwright/test').Page) =>
	page.evaluate(() =>
		parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-normal'))
	);
async function openTheme(page: import('@playwright/test').Page) {
	const dialog = await openSettingsDialog(page);
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Theme' })
		.tap();
	return dialog;
}

test('Off in Settings stops animations on this device, and stays off; the menu has no switch', async ({
	page
}) => {
	await page.goto('/');
	expect(await off(page)).toBe(false);
	expect(await token(page)).toBeGreaterThan(0);

	let dialog = await openTheme(page);
	await dialog.getByRole('combobox', { name: 'Animations' }).tap();
	await page.getByRole('option', { name: 'Off', exact: true }).tap();
	await expect.poll(() => off(page)).toBe(true);
	expect(await token(page)).toBe(0);

	// Remembered on this device.
	await page.reload();
	await expect.poll(() => off(page)).toBe(true);
	dialog = await openTheme(page);
	await expect(dialog.getByRole('combobox', { name: 'Animations' })).toHaveText(/Off/);

	// Not in the menu (Trevor, 2026-11-16: "should not be in the left sidebar").
	await page.reload();
	const menu = await theMenu(page);
	await expect(menu.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
	await expect(menu.getByRole('checkbox', { name: 'Animations' })).toHaveCount(0);
});

test("Match device follows the device's Reduce motion; On and Off overrule it", async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expect.poll(() => off(page)).toBe(true);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect.poll(() => off(page)).toBe(false);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	const dialog = await openTheme(page);
	const choice = dialog.getByRole('combobox', { name: 'Animations' });
	await expect(choice).toHaveText(/Match device/);
	await choice.tap();
	await page.getByRole('option', { name: 'On', exact: true }).tap();
	await expect.poll(() => off(page)).toBe(false);
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await choice.tap();
	await page.getByRole('option', { name: 'Off', exact: true }).tap();
	await expect.poll(() => off(page)).toBe(true);
});
