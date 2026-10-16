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

/** Opens the Settings modal over the current page, optionally at one section (e.g. `appearance`). */
export function openSettings(section: string | null = null): void {
	settingsDialog.show(section);
}

/** Goes to the Account page: sign in, or the signed-in account. */
export function openAccount(): Promise<void> {
	return goto(resolve('/account'));
}
