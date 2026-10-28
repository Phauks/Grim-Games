/**
 * What the app keeps on this device, and clearing it (Settings > Data, Trevor 2026-10-16).
 *
 * Every clear ends with a page reload, so each feature's store starts again from what is left.
 * The stores that hold a database connection close it when it is deleted (`onversionchange`
 * in idb-store.ts, script-library.ts and notebook-store.svelte.ts); a reload releases any
 * other, so a deletion that was waiting on it finishes before the app opens it again.
 */
import { DB_NAME as GAMES_DB } from '#lib/features/game/db-name.ts';
import { SCRIPTS_DB_NAME } from '#lib/features/scripts/script-library.ts';

/** Every key and database name the app writes starts with this. */
const APP_PREFIX = 'grim-games';

/** The player view's notebook database (src/lib/features/player/notebook-store.svelte.ts). */
export const NOTES_DB = 'grim-games-player';
export { GAMES_DB, SCRIPTS_DB_NAME as SCRIPTS_DB };

/** Copies of wiki text kept on this device (glossary and character pages). */
const WIKI_KEYS = ['grim-games:wiki-glossary', 'grim-games:wiki-pages'];

export interface StorageUse {
	/** Bytes used by this site on this device, or null when the browser doesn't say. */
	total: number | null;
	/** Saved data (IndexedDB), when the browser breaks it down (Chromium only). */
	saved: number | null;
	/** The offline copy of the app and stored icons (Cache Storage), likewise. */
	offline: number | null;
}

type Estimate = StorageEstimate & { usageDetails?: Record<string, number> };

export async function storageUse(): Promise<StorageUse> {
	try {
		const estimate = (await navigator.storage?.estimate?.()) as Estimate | undefined;
		const details = estimate?.usageDetails;
		return {
			total: estimate?.usage ?? null,
			saved: details ? (details.indexedDB ?? 0) : null,
			offline: details ? (details.caches ?? 0) + (details.serviceWorkerRegistrations ?? 0) : null
		};
	} catch {
		return { total: null, saved: null, offline: null };
	}
}

function deleteDatabase(name: string): Promise<void> {
	return new Promise((resolve) => {
		const request = indexedDB.deleteDatabase(name);
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		// Another tab still has it open: the deletion finishes when that closes or reloads.
		request.onblocked = () => resolve();
	});
}

/** Removes localStorage keys that match, leaving the rest. */
export function removeKeys(storage: Storage, matches: (key: string) => boolean): void {
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key !== null && matches(key)) keys.push(key);
	}
	for (const key of keys) storage.removeItem(key);
}

/** True for a key this app wrote (`grim-games:…`, `grim-games.…`, `grim-games-…`). */
export function isAppKey(key: string): boolean {
	return key === APP_PREFIX || /^grim-games[:.-]/.test(key);
}

/** True for a wiki text copy, any version (`grim-games:wiki-glossary:v2` included). */
export function isWikiKey(key: string): boolean {
	return WIKI_KEYS.some((prefix) => key === prefix || key.startsWith(`${prefix}:`));
}

export async function clearDatabases(names: readonly string[]): Promise<void> {
	await Promise.all(names.map(deleteDatabase));
}

/** Reloads so every store starts again from what is left. */
export function reloadApp(): void {
	location.reload();
}
