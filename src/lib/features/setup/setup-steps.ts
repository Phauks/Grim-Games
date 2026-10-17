import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { Game } from '#lib/core/model/index.ts';
import { setupComplete } from '#lib/core/rules/index.ts';

/**
 * The one setup flow (Trevor, 2026-10-16): Characters, then Draw, moved between by the bar
 * at the bottom (no step header, Trevor 2026-10-17). Finishing the draw opens the board with
 * its setup reminders tray, which is not a step of its own.
 */
export type SetupStep = 'characters' | 'draw' | 'reminders';

/** The URL hash that opens the board with its setup reminders tray. */
export const REMINDERS_HASH = '#setup-reminders';

/** Where the board's Set up button resumes: the draw once a bag is built, else characters. */
export function currentSetupStep(game: Game): SetupStep {
	if (setupComplete(game)) return 'reminders';
	return game.bag && Object.keys(game.bag.tiles).length > 0 ? 'draw' : 'characters';
}

/** The board with its setup reminders tray open: the last setup step. */
export function remindersHref(gameId: string): ResolvedPathname {
	return `${resolve('/grimoire/[gameId]', { gameId })}${REMINDERS_HASH}` as ResolvedPathname;
}
