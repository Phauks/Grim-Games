import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';

/**
 * Route data that hides the sidebar. A game in progress returns
 * `{ chrome: 'game' }` from its `+layout.ts`, so a stray tap on a menu link
 * can't leave the game (Trevor, 2026-10-16). That screen's own menu offers Settings, Account
 * and Exit game instead, using the functions below.
 */
export type Chrome = 'app' | 'game';

/** Whether the sidebar shows, given the current page's route data. */
export function showsAppShell(data: Record<string, unknown> | null | undefined): boolean {
	return data?.chrome !== 'game';
}

/**
 * A locked pass-the-phone draw (2026-10-19; draw-lock.svelte.ts) hides the
 * sidebar on that game's screens, so the only way out is its PIN. Elsewhere it
 * shows, and that game's board asks for the PIN.
 */
export function lockedDrawHidesShell(pathname: string, lockedGame: string | undefined): boolean {
	if (!lockedGame) return false;
	const game = `/grimoire/${lockedGame}`;
	return pathname === game || pathname.startsWith(`${game}/`);
}

/**
 * Asks before leaving a screen where leaving would lose or interrupt something: a game in
 * progress (board), a bag draw (Character selection). The screen registers a guard while it
 * is open, which shows its own confirmation and calls `leave` on Confirm.
 *
 * The root layout checks every navigation against it (`beforeNavigate`): the navigation menu,
 * in-page links and the browser's Back button all ask first. Navigations that stay inside the
 * screen (`within`, e.g. the board and its day screen) and closing the tab don't ask.
 *
 * Guards stack: the newest one asks, and removing it hands back to the one beneath. A locked
 * bag draw sets a PIN guard over the draw's Confirm, and unlocking must leave the Confirm in
 * place (pass-the-phone draw, Trevor 2026-10-19). A guard may show any dialog, such as the PIN
 * dialog, and call `leave` once the person may go.
 */
export type LeaveGuard = (leave: () => void) => void;

interface Registered {
	guard: LeaveGuard;
	within: (url: URL) => boolean;
	survivesReload: boolean;
}

export interface LeaveGuardOptions {
	/**
	 * The screen comes back as it was after a reload (a game's board reopens from its save), so
	 * a new build may take over while the app is in the background (auto-update.svelte.ts).
	 */
	survivesReload?: boolean;
}

const guards: Registered[] = [];
/** The guard that asks now: the newest one still set. */
const top = (): Registered | undefined => guards[guards.length - 1];
// A one-shot pass for the confirmed leave's navigation, so it isn't asked about again.
let confirmed = false;
let passes = 0;

/**
 * Registers the guard; returns a function that removes it (use as an `$effect` cleanup).
 * `within` lists the URLs that are still this screen; by default any change of path asks.
 */
export function setLeaveGuard(
	guard: LeaveGuard,
	within: (url: URL) => boolean = () => false,
	{ survivesReload = false }: LeaveGuardOptions = {}
): () => void {
	const entry = { guard, within, survivesReload };
	guards.push(entry);
	markGuarded(true);
	return () => {
		const at = guards.indexOf(entry);
		if (at < 0) return;
		guards.splice(at, 1);
		if (guards.length > 0) return;
		confirmed = false;
		markGuarded(false);
	};
}

/** Whether a leave guard is set: a game in progress or a bag draw is on screen. */
export function isGuarded(): boolean {
	return guards.length > 0;
}

/** Whether a guard is set whose screen would lose something if the page reloaded. */
export function guardBlocksReload(): boolean {
	return guards.some((entry) => !entry.survivesReload);
}

/** Pull-to-refresh is off while a guard is set (base.css), so a pull can't skip its question. */
function markGuarded(on: boolean): void {
	if (typeof document === 'undefined') return;
	document.documentElement.toggleAttribute('data-leave-guard', on);
}

/** Runs `leave` now, or after the screen's confirmation when a guard is registered. */
export function leaveTo(leave: () => void): void {
	const registered = top();
	if (!registered) return leave();
	registered.guard(() => leaveWithoutAsking(leave));
}

/**
 * Runs `leave` past any guard, for a way out the person can't refuse: the room was handed to
 * another Storyteller's device, so this one is put out of the game (Room transfer).
 */
export function leaveWithoutAsking(leave: () => void): void {
	confirmed = true;
	const pass = ++passes;
	// goto() awaits route resolution before asking, so the pass must outlive the call; the
	// navigation uses it up, and this only clears it if `leave` never navigated.
	setTimeout(() => {
		if (pass === passes) confirmed = false;
	}, 5000);
	leave();
}

/**
 * Whether a navigation must ask first. `type` is SvelteKit's navigation type; `leave` (closing
 * the tab, typing an address) can only show the browser's own prompt, so it never asks here.
 */
export function mustAskBeforeLeaving(to: URL | null, type: string, from: URL): boolean {
	const registered = top();
	if (!registered || type === 'leave' || !to) return false;
	if (confirmed) {
		confirmed = false;
		return false;
	}
	if (to.origin !== from.origin) return false;
	if (to.pathname === from.pathname) return false;
	return !registered.within(to);
}

/** Opens the Settings modal over the current page, optionally at one section (e.g. `appearance`). */
export function openSettings(section: string | null = null): void {
	settingsDialog.show(section);
}

/** Goes to the Account page: sign in, or the signed-in account. */
export function openAccount(): Promise<void> {
	return goto(resolve('/account'));
}
