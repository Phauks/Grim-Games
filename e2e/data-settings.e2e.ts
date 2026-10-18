import { expect, test, type Page } from '@playwright/test';

// Trevor (2026-10-16): the Data section is a table of what is stored, by size; chosen rows clear.

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

test('the Data section is a table of what is stored and its size, with Reset settings', async ({
	page
}) => {
	await page.goto('/');
	await seedDatabase(page, 'grim-games-scripts');
	const dialog = await openData(page);
	const table = dialog.getByTestId('storage-table');
	for (const name of [
		'Saved games',
		'Player notes',
		'Recent scripts',
		'Settings',
		'Other saved data',
		'Wiki text copies',
		'Stored character icons',
		'Offline copy of the app'
	]) {
		await expect(table.getByRole('rowheader', { name: new RegExp(`^${name}`) })).toBeVisible();
	}
	// Measured sizes replace the placeholders in place.
	await expect(table).not.toContainText('…');
	await expect(dialog.getByTestId('storage-use')).toContainText('Total measured');
	// The app's own offline copy can't be cleared; nothing is selected at first.
	await expect(
		table.getByRole('checkbox', { name: 'Select Offline copy of the app' })
	).toBeDisabled();
	await expect(dialog.getByRole('button', { name: 'Clear selected' })).toBeDisabled();
	// Resets live in each section's header now (Trevor, 2026-10-18).
	await expect(dialog.getByRole('button', { name: 'Reset all' })).toHaveCount(0);
});

test('clearing the selected rows asks first, then deletes only those', async ({ page }) => {
	await page.goto('/');
	await seedDatabase(page, 'grim-games-scripts');
	await seedDatabase(page, 'grim-games-player');
	const dialog = await openData(page);
	const table = dialog.getByTestId('storage-table');

	await table.getByRole('checkbox', { name: 'Select Recent scripts' }).tap();
	await dialog.getByRole('button', { name: 'Clear selected' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Clear the selected data?' });
	await expect(confirm.getByRole('listitem')).toHaveText(['Recent scripts']);
	await confirm.getByRole('button', { name: 'Cancel' }).tap();
	await expect(confirm).toBeHidden();
	expect(await stillSeeded(page, 'grim-games-scripts')).toBe(true);

	await dialog.getByRole('button', { name: 'Clear selected' }).tap();
	// The app reloads once the store is gone.
	const reloaded = page.waitForEvent('load');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await reloaded;
	await expect.poll(() => stillSeeded(page, 'grim-games-scripts')).toBe(false);
	expect(await stillSeeded(page, 'grim-games-player')).toBe(true);
});

test('Select all clears settings and saved data, not other sites', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => {
		localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ textScale: 1.25 }));
		localStorage.setItem('someone-else', 'stays');
	});
	// A database name the app doesn't know yet: it is listed as Other saved data.
	await seedDatabase(page, 'grim-games-future');
	await page.reload();
	const dialog = await openData(page);

	await dialog.getByRole('checkbox', { name: 'Select all' }).tap();
	await dialog.getByRole('button', { name: 'Clear selected' }).tap();
	const reloaded = page.waitForEvent('load');
	await page
		.getByRole('alertdialog', { name: 'Clear the selected data?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await reloaded;
	await expect.poll(() => stillSeeded(page, 'grim-games-future')).toBe(false);
	expect(await page.evaluate(() => localStorage.getItem('grim-games:preferences:v1'))).toBeNull();
	expect(await page.evaluate(() => localStorage.getItem('someone-else'))).toBe('stays');
});
