/**
 * Takes a downloaded build by itself when that interrupts nothing (Trevor, 2026-10-27). A build
 * that waited for Refresh left phones hours behind on beta, which deploys every 15–30 minutes:
 * colours fixed the day before still showed, and a Settings cog did nothing. The update card
 * (UpdateBanner) stays for a game on screen; elsewhere the new build takes over
 * - on the way to another page, which then loads afresh on it, outside a game;
 * - after the app spent `AWAY_MS` in the background, on any screen that comes back as it was
 *   after a reload (a game's board reopens from its save), unless a dialog or sheet is open.
 */
import { claimFreshLoad, staleBuild } from '#lib/features/offline/stale-build.svelte.ts';
import { guardBlocksReload, isGuarded } from '#lib/features/shell/shell.ts';
import { updateCheck } from './update-check.svelte.ts';

/** Time the app spends in the background before a waiting build takes over on its own. */
export const AWAY_MS = 30_000;

export interface Screen {
	/** A game in progress or a bag draw is on screen. */
	inGame: boolean;
	/** The screen would lose something if the page reloaded (a bag draw). */
	reloadLoses: boolean;
	/** A dialog or sheet is open, which a reload would close. */
	dialogOpen: boolean;
}

/** Whether a navigation to another page takes the waiting build: anywhere outside a game. */
export function takesUpdateOnNavigate(ready: boolean, screen: Screen, samePage: boolean): boolean {
	return ready && !samePage && !screen.inGame;
}

/** Whether coming back after `awayMs` in the background takes the waiting build. */
export function takesUpdateAfterAway(ready: boolean, awayMs: number, screen: Screen): boolean {
	return ready && awayMs >= AWAY_MS && !screen.reloadLoses && !screen.dialogOpen;
}

/** The screen as it is now; `gamePage` says the current route is a game's (shell.ts `Chrome`). */
function screenNow(gamePage: boolean): Screen {
	return {
		inGame: gamePage || isGuarded(),
		reloadLoses: guardBlocksReload(),
		dialogOpen: !!document.querySelector('[role="dialog"], [role="alertdialog"]')
	};
}

/**
 * For the root layout's `beforeNavigate`: true when the navigation was handed to the waiting
 * build (the caller cancels it; the page at `href` loads afresh).
 */
export function updateOnNavigate(href: string, gamePage: boolean): boolean {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read once, never kept
	const samePage = new URL(href, location.href).pathname === location.pathname;
	if (!takesUpdateOnNavigate(updateCheck.ready, screenNow(gamePage), samePage)) return false;
	void updateCheck.refresh(href);
	return true;
}

/**
 * Watches the app going to the background and coming back; returns the cleanup. The check runs
 * while still hidden when the browser lets a timer fire then, so the reload is never seen, and
 * again on return for browsers that pause hidden pages.
 */
export function watchAway(gamePage: () => boolean): () => void {
	let hiddenAt: number | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const tryUpdate = () => {
		if (hiddenAt === undefined) return;
		const away = Date.now() - hiddenAt;
		if (!takesUpdateAfterAway(updateCheck.ready, away, screenNow(gamePage()))) return;
		hiddenAt = undefined;
		void updateCheck.refresh();
	};
	const onVisibility = () => {
		clearTimeout(timer);
		if (document.visibilityState === 'hidden') {
			hiddenAt = Date.now();
			timer = setTimeout(tryUpdate, AWAY_MS);
		} else {
			tryUpdate();
			hiddenAt = undefined;
		}
	};
	document.addEventListener('visibilitychange', onVisibility);
	return () => {
		clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisibility);
	};
}

let recovering = false;

/**
 * A code file this page needed could not be loaded, such as Settings' when its cog is tapped
 * (2026-10-27: the cog did nothing). The page reloads on the newest build the device holds,
 * taking a waiting one first; at most once a minute (stale-build.svelte.ts). False when it
 * already tried, so the caller shows the error instead.
 */
export function recoverMissingFile(): boolean {
	staleBuild.mark();
	if (recovering) return true;
	if (!claimFreshLoad()) return false;
	recovering = true;
	void updateCheck.refresh();
	return true;
}

/**
 * Vite's report of a code file that failed to load (vite:preloadError). The page reloads
 * unless that would cut something short (an open dialog, a bag draw); then the next page loads
 * afresh instead (stale-build.svelte.ts). True when the reload is under way.
 */
export function recoverPreloadError(gamePage: boolean): boolean {
	const screen = screenNow(gamePage);
	if (screen.dialogOpen || screen.reloadLoses) {
		staleBuild.mark();
		return false;
	}
	return recoverMissingFile();
}
