import { expect, test, type Page } from '@playwright/test';
import { theMenu } from './shell.ts';

// Trevor (2026-11-16, option B): Install app is also a button in the menu, under Settings, while
// the browser can install the app. Every Install app button opens one dialog whose steps fit the
// browser; the Google app's window (a friend couldn't install from it) is told to open Safari.

const IPHONE = (browser: string) =>
	`Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${browser} Mobile/15E148 Safari/604.1`;
const GOOGLE_APP = IPHONE('GSA/390.0.812345');
const CHROME_IPHONE = IPHONE('CriOS/142.0.7444.77');

async function openInstall(page: Page) {
	await page.goto('/');
	const menu = await theMenu(page);
	const settings = menu.getByRole('button', { name: 'Settings', exact: true });
	const install = menu.getByRole('button', { name: 'Install app' });
	// Right under Settings.
	const above = await settings.boundingBox();
	const box = await install.boundingBox();
	expect(box!.y).toBeGreaterThan(above!.y + above!.height - 1);
	expect(box!.height).toBeGreaterThanOrEqual(43.9);
	await install.tap();
	const dialog = page.getByRole('dialog', { name: 'Install app' });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe('in the Google app', () => {
	test.use({ userAgent: GOOGLE_APP, permissions: ['clipboard-read', 'clipboard-write'] });

	test('the menu says to open the page in Safari first, then gives the Safari steps', async ({
		page
	}) => {
		const dialog = await openInstall(page);
		await expect(dialog).toContainText(
			"The Google app opens pages in its own window, which can't install"
		);
		await expect(dialog.getByRole('button', { name: 'Open in Safari' })).toBeVisible();
		await dialog.getByRole('button', { name: 'Copy link' }).tap();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
		await expect(dialog.getByRole('listitem')).toHaveText([
			/Tap ⋯ beside the address/,
			/Tap Share/,
			/Tap Add to Home Screen/,
			/Tap Add/
		]);
	});
});

test.describe('in Chrome on an iPhone', () => {
	test.use({ userAgent: CHROME_IPHONE });

	test('the menu gives Chrome its Share steps', async ({ page }) => {
		const dialog = await openInstall(page);
		await expect(dialog.getByRole('button', { name: 'Open in Safari' })).toHaveCount(0);
		await expect(dialog.getByRole('listitem')).toHaveText([
			/Tap Share/,
			/Tap Add to Home Screen/,
			/Tap Add/
		]);
	});
});

test('opened as an installed app, the menu has no Install app button', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
	);
	await page.goto('/');
	const menu = await theMenu(page);
	await expect(menu.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
	await expect(menu.getByRole('button', { name: 'Install app' })).toHaveCount(0);
});
