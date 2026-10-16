/**
 * Which files the service worker stores up front, and which it stores on first use.
 *
 * Precaching every build file put about 11.5 MB on each device, mostly files a game never
 * needs (measured with `navigator.storage.estimate()` on a fresh visit, 2026-10-16):
 * - character icons for every edition (7.9 MB), when a game only shows its script's;
 * - `.woff` fonts (1.0 MB), which no browser with service workers asks for, since they
 *   all take the `.woff2` listed first in each `@font-face`;
 * - Cyrillic, Greek and Vietnamese font subsets, which a browser only fetches when the
 *   page has text in those scripts.
 *
 * Those are cached on first use instead (`RUNTIME_CACHE`), and the current script's icons
 * are fetched ahead of time (`keep-offline.ts`) so a game still works with no signal.
 */

/** Cache for files stored on first use. Kept across builds, unlike the precache. */
export const RUNTIME_CACHE = 'grim-games-runtime-v1';

/** Message the app posts to have the service worker store these URLs now. */
export interface KeepOfflineMessage {
	type: 'KEEP_OFFLINE';
	urls: string[];
}

/** Character icon folders whose icons are cached on first use (`/data/icons/<edition>/`). */
const ICONS = /^\/data\/icons\/(?!generic\/)[^/]+\//;
/** Font subsets an English-language game does not show. */
const OTHER_SUBSETS = /-(cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-[^/]*\.woff2$/;

/** True for a build file the service worker should store at install time. */
export function precached(path: string): boolean {
	if (ICONS.test(path)) return false;
	if (path.endsWith('.woff')) return false;
	return !OTHER_SUBSETS.test(path);
}

/** True for a same-origin GET the service worker should store when first fetched. */
export function cachedOnUse(path: string): boolean {
	return path.startsWith('/data/icons/') || path.startsWith('/_app/immutable/');
}
