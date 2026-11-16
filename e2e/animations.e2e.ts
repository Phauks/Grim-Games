import { expect, test } from '@playwright/test';
import { openSettingsDialog, theMenu } from './shell.ts';

/**
 * One Animations setting for players, Storytellers and spectators alike (Trevor, 2026-11-16,
 * option B): Match device, On or Off in Settings > Theme, and a switch in the app menu that
 * every screen has. While animations are off, `<html>` carries `data-motion-off` and every
 * motion token is 0ms.
 */
const off = (page: import('@playwright/test').Page) =>
	page.evaluate(() => document.documentElement.hasAttribute('data-motion-off'));
const token = (page: import('@playwright/test').Page) =>
	page.evaluate(() =>
		parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-normal'))
	);

test('the menu switch turns animations off on this device, and it stays off', async ({ page }) => {
	await page.goto('/');
	const menu = await theMenu(page);
	const animations = menu.getByRole('checkbox', { name: 'Animations' });
	await expect(animations).toBeChecked();
	expect(await off(page)).toBe(false);
	expect(await token(page)).toBeGreaterThan(0);

	await menu.getByTestId('menu-animations').getByText('Animations', { exact: true }).tap();
	await expect(animations).not.toBeChecked();
	await expect.poll(() => off(page)).toBe(true);
	expect(await token(page)).toBe(0);

	// Remembered on this device, and shown as Off in Settings.
	await page.reload();
	await expect.poll(() => off(page)).toBe(true);
	const dialog = await openSettingsDialog(page);
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Theme' })
		.tap();
	await expect(dialog.getByRole('combobox', { name: 'Animations' })).toHaveText(/Off/);
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
	const dialog = await openSettingsDialog(page);
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Theme' })
		.tap();
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
