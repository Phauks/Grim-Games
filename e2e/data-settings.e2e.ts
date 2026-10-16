import { expect, test, type Page } from '@playwright/test';

// Trevor (2026-10-16): Reset settings becomes a Data section with storage use and clear options.

async function openData(page: Page) {
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Data' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Data', level: 2 })).toBeVisible();
	return dialog;
}

/**
 * Whether a database still holds what `seedDatabase` put there. The app may open a cleared
 * database again straight away (the home page lists games), so check the seeded store.
 */
const stillSeeded = (page: Page, name: string) =>
	page.evaluate(async (dbName) => {
		const names = (await indexedDB.databases()).map((db) => db.name);
		if (!names.includes(dbName)) return false;
		return new Promise<boolean>((resolve) => {
			const request = indexedDB.open(dbName);
			request.onsuccess = () => {
				const seeded = request.result.objectStoreNames.contains('things');
				request.result.close();
				resolve(seeded);
			};
			request.onerror = () => resolve(false);
		});
	}, name);

/** Makes a database with one record, as a feature store would. */
const seedDatabase = (page: Page, name: string) =>
	page.evaluate(
		(dbName) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open(dbName, 1);
				request.onupgradeneeded = () => request.result.createObjectStore('things');
				request.onsuccess = () => {
					const tx = request.result.transaction('things', 'readwrite');
					tx.objectStore('things').put('kept', 'one');
					tx.oncomplete = () => {
						request.result.close();
						resolve();
					};
				};
				request.onerror = () => reject(request.error);
			}),
		name
	);

test('the Data section shows storage use and Reset settings', async ({ page }) => {
	await page.goto('/');
	const dialog = await openData(page);
	const use = dialog.getByTestId('storage-use');
	await expect(use).toContainText('Total');
	await expect(use).not.toContainText('…');
	await expect(dialog.getByRole('button', { name: 'Reset all' })).toBeVisible();
});

test('clearing recent scripts asks first, then deletes only that store', async ({ page }) => {
	await page.goto('/');
	await seedDatabase(page, 'grim-games-scripts');
	await seedDatabase(page, 'grim-games-player');
	const dialog = await openData(page);

	await dialog.getByRole('button', { name: 'Clear recent scripts' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Clear recent scripts?' });
	await expect(confirm).toContainText('Scripts saved to your account');
	await confirm.getByRole('button', { name: 'Cancel' }).tap();
	await expect(confirm).toBeHidden();
	expect(await stillSeeded(page, 'grim-games-scripts')).toBe(true);

	await dialog.getByRole('button', { name: 'Clear recent scripts' }).tap();
	// The app reloads once the store is gone.
	const reloaded = page.waitForEvent('load');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await reloaded;
	await expect.poll(() => stillSeeded(page, 'grim-games-scripts')).toBe(false);
	expect(await stillSeeded(page, 'grim-games-player')).toBe(true);
});

test('clearing all data removes settings and saved data, not other sites', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => {
		localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ textScale: 1.25 }));
		localStorage.setItem('someone-else', 'stays');
	});
	// A database name the app doesn't know yet: clearing everything sweeps every app database.
	await seedDatabase(page, 'grim-games-future');
	await page.reload();
	const dialog = await openData(page);

	await dialog.getByRole('button', { name: 'Clear all data on this device' }).tap();
	const reloaded = page.waitForEvent('load');
	await page
		.getByRole('alertdialog', { name: 'Clear all data on this device?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await reloaded;
	await expect.poll(() => stillSeeded(page, 'grim-games-future')).toBe(false);
	expect(await page.evaluate(() => localStorage.getItem('grim-games:preferences:v1'))).toBeNull();
	expect(await page.evaluate(() => localStorage.getItem('someone-else'))).toBe('stays');
});
