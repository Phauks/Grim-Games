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
 * Asks before leaving a game. A game screen registers one while it is open; the navigation
 * menu calls `leaveTo` so leaving through it confirms exactly as Exit game does.
 */
export type LeaveGuard = (leave: () => void) => void;

let leaveGuard: LeaveGuard | null = null;

/** Registers the guard; returns a function that removes it (use as an `$effect` cleanup). */
export function setLeaveGuard(guard: LeaveGuard): () => void {
	leaveGuard = guard;
	return () => {
		if (leaveGuard === guard) leaveGuard = null;
	};
}

/** Runs `leave` now, or after the open game's confirmation when one is registered. */
export function leaveTo(leave: () => void): void {
	if (leaveGuard) leaveGuard(leave);
	else leave();
}

/** Opens the Settings modal over the current page, optionally at one section (e.g. `appearance`). */
export function openSettings(section: string | null = null): void {
	settingsDialog.show(section);
}

/** Goes to the Account page: sign in, or the signed-in account. */
export function openAccount(): Promise<void> {
	return goto(resolve('/account'));
}
