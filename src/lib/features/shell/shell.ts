import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';

/**
 * Route data that hides the app header and footer. A game in progress returns
 * `{ chrome: 'game' }` from its `+layout.ts`, so a stray tap on Grim-Games or a footer link
 * can't leave the game (Trevor, 2026-10-16). That screen's own menu offers Settings, Account
 * and Exit game instead, using the functions below.
 */
export type Chrome = 'app' | 'game';

/** Whether the app header and footer show, given the current page's route data. */
export function showsAppShell(data: Record<string, unknown> | null | undefined): boolean {
	return data?.chrome !== 'game';
}

/**
 * Asks before leaving a screen where leaving would lose or interrupt something: a game in
 * progress (board), a bag draw (Character selection). The screen registers a guard while it
 * is open, which shows its own confirmation and calls `leave` on Confirm.
 *
 * The root layout checks every navigation against it (`beforeNavigate`): the navigation menu,
 * in-page links and the browser's Back button all ask first. Navigations that stay inside the
 * screen (`within`, e.g. the board and its day screen) and closing the tab don't ask.
 */
export type LeaveGuard = (leave: () => void) => void;

interface Registered {
	guard: LeaveGuard;
	within: (url: URL) => boolean;
}

let registered: Registered | null = null;
// A one-shot pass for the confirmed leave's navigation, so it isn't asked about again.
let confirmed = false;
let passes = 0;

/**
 * Registers the guard; returns a function that removes it (use as an `$effect` cleanup).
 * `within` lists the URLs that are still this screen; by default any change of path asks.
 */
export function setLeaveGuard(
	guard: LeaveGuard,
	within: (url: URL) => boolean = () => false
): () => void {
	const entry = { guard, within };
	registered = entry;
	markGuarded(true);
	return () => {
		if (registered !== entry) return;
		registered = null;
		confirmed = false;
		markGuarded(false);
	};
}

/** Pull-to-refresh is off while a guard is set (base.css), so a pull can't skip its question. */
function markGuarded(on: boolean): void {
	if (typeof document === 'undefined') return;
	document.documentElement.toggleAttribute('data-leave-guard', on);
}

/** Runs `leave` now, or after the screen's confirmation when a guard is registered. */
export function leaveTo(leave: () => void): void {
	if (!registered) return leave();
	registered.guard(() => {
		confirmed = true;
		const pass = ++passes;
		// goto() awaits route resolution before asking, so the pass must outlive the call; the
		// navigation uses it up, and this only clears it if `leave` never navigated.
		setTimeout(() => {
			if (pass === passes) confirmed = false;
		}, 5000);
		leave();
	});
}

/**
 * Whether a navigation must ask first. `type` is SvelteKit's navigation type; `leave` (closing
 * the tab, typing an address) can only show the browser's own prompt, so it never asks here.
 */
export function mustAskBeforeLeaving(to: URL | null, type: string, from: URL): boolean {
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
