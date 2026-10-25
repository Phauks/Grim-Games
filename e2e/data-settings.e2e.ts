import { expect, test, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

// Trevor (2026-10-16): the Data section is a table of what is stored, by size; chosen rows clear.

async function openData(page: Page) {
	await openSettingsDialog(page);
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

// Storage plan (Trevor, 2026-10-18): the app asks the browser to keep its data, always and with
// no row in Settings (2026-10-19), and on iPhone Safari, where everything is deleted after 7 days
// without a visit, offers Add to Home Screen.
test('the browser is asked to keep the data, and Data offers Add to Home Screen on iPhone Safari', async ({
	page
}, testInfo) => {
	await page.addInitScript(() => {
		const storage = navigator.storage;
		if (!storage) return;
		const asked = { count: 0 };
		Object.defineProperty(window, '__keepAsked', { value: asked });
		storage.persisted = async () => false;
		storage.persist = async () => (asked.count++, false);
	});
	await page.goto('/');
	await expect
		.poll(() =>
			page.evaluate(() => (window as { __keepAsked?: { count: number } }).__keepAsked?.count ?? 1)
		)
		.toBeGreaterThan(0);
	const dialog = await openData(page);
	await expect(dialog.getByText('Kept by the browser')).toHaveCount(0);
	const steps = dialog.getByTestId('home-screen-steps');
	// The phone project is an iPhone 13 (Safari's user agent); the tablet is Android.
	if (testInfo.project.name === 'phone') {
		await expect(steps).toContainText('Add to Home Screen');
		await expect(dialog.getByText(/after 7 days/)).toBeVisible();
	} else {
		await expect(steps).toHaveCount(0);
	}
});

test('opened from the Home Screen, Add to Home Screen is not offered', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
	);
	await page.goto('/');
	const dialog = await openData(page);
	await expect(dialog.getByTestId('home-screen-steps')).toHaveCount(0);
});

test('the table scrolls under the sticky Data heading, never over it', async ({ page }) => {
	await page.goto('/');
	const dialog = await openData(page);
	const table = dialog.getByTestId('storage-table');
	await expect(table.getByRole('row').nth(1)).toBeVisible();
	const heading = dialog.getByRole('heading', { name: 'Data', level: 2 });
	// Scroll the section until the table's top sits halfway up the sticky heading row.
	const covered = await heading.evaluate((h2, tableTestId) => {
		const row = h2.parentElement!;
		const content = row.parentElement!;
		const tableBox = document.querySelector(`[data-testid="${tableTestId}"]`)!;
		const rowBox = row.getBoundingClientRect();
		content.scrollTop += tableBox.getBoundingClientRect().top - rowBox.top - rowBox.height / 2;
		const after = row.getBoundingClientRect();
		const top = tableBox.getBoundingClientRect().top;
		const y = Math.max(top + 1, after.top + after.height / 2);
		const points = [0.1, 0.5, 0.9].map((f) => after.left + after.width * f);
		return {
			under: top < after.bottom,
			onTop: points.map((x) => row.contains(document.elementFromPoint(x, y)))
		};
	}, 'storage-table');
	expect(covered.under).toBe(true);
	expect(covered.onTop).toEqual([true, true, true]);
});
