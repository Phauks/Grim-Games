/**
 * A code file of the build this tab runs can no longer be loaded (2026-10-23: "Failed to fetch
 * dynamically imported module" on a game and a watch page after a morning of beta deploys).
 * Every build file is precached (cache-rules.ts), so this happens to a page left open on an
 * older build once its cache is gone: the service worker keeps only the active build and the
 * one before it (`staleCaches`), and the server only serves the newest. It is not a bug to
 * report. The next navigation loads its page afresh instead, on the build the service worker
 * holds.
 */

/** What each browser says when a module file fails to load. */
const MISSING_MODULE = [
	/Failed to fetch dynamically imported module/, // Chrome, Edge
	/error loading dynamically imported module/, // Firefox
	/Importing a module script failed/ // Safari
];

/** True for an error saying a code file of this build could not be loaded. */
export function isMissingBuildFile(error: unknown): boolean {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
	return MISSING_MODULE.some((pattern) => pattern.test(message));
}

let stale = $state(false);

/** Whether this tab has found its build's files gone. */
export const staleBuild = {
	get current() {
		return stale;
	},
	mark() {
		stale = true;
	}
};

const LAST_RELOAD_KEY = 'grim-games:stale-build-reload';
/** A fresh load that hits the same error again within this time is left to show it. */
export const RELOAD_GAP_MS = 60_000;

/**
 * Whether a fresh load is allowed now: at most one a minute, so a file that is gone even from
 * the newest build shows the error page instead of reloading forever.
 */
export function mayLoadAfresh(now: number, last: number | undefined): boolean {
	return last === undefined || !(now - last < RELOAD_GAP_MS);
}

/** Loads `href` as a new page (the service worker serves the build it holds). */
export function loadAfresh(href: string): boolean {
	const now = Date.now();
	try {
		const raw = sessionStorage.getItem(LAST_RELOAD_KEY);
		if (!mayLoadAfresh(now, raw === null ? undefined : Number(raw))) return false;
		sessionStorage.setItem(LAST_RELOAD_KEY, String(now));
	} catch {
		// Storage blocked: load anyway; the new page starts with the flag cleared.
	}
	location.assign(href);
	return true;
}
