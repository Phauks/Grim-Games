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

/** Prefix of each build's precache name (`grim-games-<version>`). */
export const BUILD_CACHE_PREFIX = 'grim-games-';

/**
 * The caches a newly active build may delete. Refresh in one tab activates the new build for
 * every tab, and the other tabs keep running the build they loaded until they reload. So the
 * build being replaced (`previous`) keeps its cache until the next update: those tabs can
 * still load the chunks they have not used yet, even offline, while Cloudflare only serves
 * the new build's files (developers.cloudflare.com/workers/static-assets/routing/advanced/gradual-rollouts/).
 */
export function staleCaches(
	keys: string[],
	current: string,
	previous: string | undefined
): string[] {
	const keep = new Set([current, RUNTIME_CACHE]);
	if (previous) keep.add(previous);
	return keys.filter((key) => key.startsWith(BUILD_CACHE_PREFIX) && !keep.has(key));
}
