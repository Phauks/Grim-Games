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
 * - day and night sound recordings (about 2.7 MB, plan U3), which only a device with day and
 *   night sound turned on plays.
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
/** Sound recordings, stored once a device turns on what plays them. */
const SOUNDS = '/sounds/';

/** True for a build file the service worker should store at install time. */
export function precached(path: string): boolean {
	// Cloudflare reads the headers file and never serves it.
	if (path === '/_headers') return false;
	if (ICONS.test(path)) return false;
	if (path.endsWith('.woff')) return false;
	if (path.startsWith(SOUNDS)) return false;
	return !OTHER_SUBSETS.test(path);
}

/** True for a same-origin GET the service worker should store when first fetched. */
export function cachedOnUse(path: string): boolean {
	return (
		path.startsWith('/data/icons/') ||
		path.startsWith('/_app/immutable/') ||
		path.startsWith(SOUNDS)
	);
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

/**
 * Each `static/` file's content hash, written by vite.config.ts (precacheSizes). A new build
 * keeps the previous build's copy of a file whose hash is the same, instead of downloading
 * it again (Trevor, 2026-10-19: updates "stutter and are somewhat slow").
 */
export const PRECACHE_HASHES_PATH = '/precache-hashes.json';

export type FileHashes = Record<string, string>;

/** The hashes file as read, keeping only string hashes. */
export function parseHashes(raw: unknown): FileHashes {
	const hashes: FileHashes = {};
	if (!raw || typeof raw !== 'object') return hashes;
	for (const [path, hash] of Object.entries(raw)) if (typeof hash === 'string') hashes[path] = hash;
	return hashes;
}

/**
 * True when a stored copy of a file from an earlier build is the same file. A build file's
 * name carries a hash of its content (`/_app/immutable/`), so any copy under that name is it;
 * other files only when the build and the previous one give the same content hash.
 */
export function unchanged(path: string, hashes: FileHashes, previous: FileHashes): boolean {
	if (path.startsWith('/_app/immutable/')) return true;
	const hash = hashes[path];
	return hash !== undefined && hash === previous[path];
}
