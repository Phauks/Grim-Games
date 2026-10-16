/**
 * What the app keeps on this device, item by item, with how much room each takes and how to
 * clear it: the Data section's table (Trevor, 2026-10-16: "semi-diagnostic", clear by
 * choosing rows).
 *
 * Browsers only report a total per site (and Chromium a split by kind), so each item is
 * measured here: the bytes of each stored record, key or cached file.
 */
import { BUILD_CACHE_PREFIX, RUNTIME_CACHE } from '#lib/features/offline/cache-rules.ts';
import {
	clearDatabases,
	GAMES_DB,
	isAppKey,
	isWikiKey,
	NOTES_DB,
	removeKeys,
	SCRIPTS_DB
} from './device-data.ts';

export type StorageItemId =
	'games' | 'notes' | 'scripts' | 'other-databases' | 'settings' | 'wiki' | 'icons' | 'app';

export interface StorageItem {
	id: StorageItemId;
	/** Bytes, or null when it couldn't be measured (no Cache Storage in a private window). */
	bytes: number | null;
	/** False for the app's own offline copy: without it the app wouldn't open offline. */
	clearable: boolean;
	/** Something the user made, so clearing it is destructive (shown in red). */
	userData: boolean;
}

/** Table order: what the user made first, then copies the app can fetch again. */
export const STORAGE_ITEM_IDS: readonly StorageItemId[] = [
	'games',
	'notes',
	'scripts',
	'settings',
	'other-databases',
	'wiki',
	'icons',
	'app'
];

const USER_DATA = new Set<StorageItemId>([
	'games',
	'notes',
	'scripts',
	'settings',
	'other-databases'
]);
const KNOWN_DATABASES = new Set([GAMES_DB, NOTES_DB, SCRIPTS_DB]);

/** Bytes a stored value takes, roughly: text as UTF-16, files at their size. */
export function valueBytes(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
	if (value instanceof ArrayBuffer) return value.byteLength;
	if (ArrayBuffer.isView(value)) return value.byteLength;
	if (typeof value === 'string') return value.length * 2;
	if (typeof value === 'number' || typeof value === 'boolean') return 8;
	if (Array.isArray(value)) return value.reduce((sum: number, v) => sum + valueBytes(v), 0);
	if (typeof value === 'object') {
		let sum = 0;
		for (const [key, v] of Object.entries(value)) sum += key.length * 2 + valueBytes(v);
		return sum;
	}
	return 0;
}

/** Bytes of the localStorage keys that match. */
export function keyBytes(storage: Storage, matches: (key: string) => boolean): number {
	let sum = 0;
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key !== null && matches(key)) sum += (key.length + (storage.getItem(key)?.length ?? 0)) * 2;
	}
	return sum;
}

/** Settings and other small app keys; wiki copies are their own row. */
const isSettingsKey = (key: string) => isAppKey(key) && !isWikiKey(key);

async function appDatabases(): Promise<string[]> {
	const listed = (await indexedDB.databases?.().catch(() => [])) ?? [];
	return listed.map((db) => db.name ?? '').filter((name) => name && isAppKey(name));
}

/** Sums every record of an existing database; 0 when it isn't there. */
function databaseBytes(name: string): Promise<number> {
	return new Promise((resolve) => {
		const request = indexedDB.open(name);
		// Opening a name that doesn't exist would create it: abort that instead.
		request.onupgradeneeded = () => request.transaction?.abort();
		request.onerror = () => resolve(0);
		request.onsuccess = () => {
			const db = request.result;
			const stores = [...db.objectStoreNames];
			if (stores.length === 0) {
				db.close();
				return resolve(0);
			}
			let sum = 0;
			const tx = db.transaction(stores, 'readonly');
			for (const store of stores) {
				const cursor = tx.objectStore(store).openCursor();
				cursor.onsuccess = () => {
					const at = cursor.result;
					if (!at) return;
					sum += valueBytes(at.key) + valueBytes(at.value);
					at.continue();
				};
			}
			tx.oncomplete = () => {
				db.close();
				resolve(sum);
			};
			tx.onerror = tx.onabort = () => {
				db.close();
				resolve(sum);
			};
		};
	});
}

async function cacheBytes(matches: (name: string) => boolean): Promise<number | null> {
	try {
		let sum = 0;
		for (const name of await caches.keys()) {
			if (!matches(name)) continue;
			const cache = await caches.open(name);
			for (const request of await cache.keys()) {
				const response = await cache.match(request);
				if (response) sum += (await response.blob()).size;
			}
		}
		return sum;
	} catch {
		return null;
	}
}

const isBuildCache = (name: string) =>
	name.startsWith(BUILD_CACHE_PREFIX) && name !== RUNTIME_CACHE;

/** Measures every item. */
export async function measureStorage(): Promise<StorageItem[]> {
	const databases = await appDatabases();
	const present = (name: string) => databases.includes(name);
	const others = databases.filter((name) => !KNOWN_DATABASES.has(name));
	const sizeOf = async (names: string[]) =>
		(await Promise.all(names.map(databaseBytes))).reduce((a, b) => a + b, 0);

	const bytes: Record<StorageItemId, number | null> = {
		games: present(GAMES_DB) ? await databaseBytes(GAMES_DB) : 0,
		notes: present(NOTES_DB) ? await databaseBytes(NOTES_DB) : 0,
		scripts: present(SCRIPTS_DB) ? await databaseBytes(SCRIPTS_DB) : 0,
		'other-databases': await sizeOf(others),
		settings: keyBytes(localStorage, isSettingsKey) + keyBytes(sessionStorage, isAppKey),
		wiki: keyBytes(localStorage, isWikiKey),
		icons: await cacheBytes((name) => name === RUNTIME_CACHE),
		app: await cacheBytes(isBuildCache)
	};
	return STORAGE_ITEM_IDS.map((id) => ({
		id,
		bytes: bytes[id],
		clearable: id !== 'app',
		userData: USER_DATA.has(id)
	}));
}

/** Clears the chosen items; the caller reloads the app afterwards (see device-data.ts). */
export async function clearItems(ids: ReadonlySet<StorageItemId>): Promise<void> {
	const databases: string[] = [];
	if (ids.has('games')) databases.push(GAMES_DB);
	if (ids.has('notes')) databases.push(NOTES_DB);
	if (ids.has('scripts')) databases.push(SCRIPTS_DB);
	if (ids.has('other-databases')) {
		databases.push(...(await appDatabases()).filter((name) => !KNOWN_DATABASES.has(name)));
	}
	await clearDatabases(databases);
	if (ids.has('settings')) {
		removeKeys(localStorage, isSettingsKey);
		removeKeys(sessionStorage, isAppKey);
	}
	if (ids.has('wiki')) removeKeys(localStorage, isWikiKey);
	if (ids.has('icons')) {
		try {
			await caches.delete(RUNTIME_CACHE);
		} catch {
			// No Cache Storage: nothing stored there.
		}
	}
}

/** The sum of the measured items. */
export function totalBytes(items: readonly StorageItem[]): number {
	return items.reduce((sum, item) => sum + (item.bytes ?? 0), 0);
}
