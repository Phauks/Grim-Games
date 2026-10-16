import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { MessageKey } from '#lib/i18n/catalog.ts';
import type { Game } from '#lib/core/model/index.ts';
import { setupComplete } from '#lib/core/rules/index.ts';

/**
 * The one setup flow (Trevor, 2026-10-16): choose characters, draw the bag, then place the
 * setup reminders on the board.
 */
export type SetupStep = 'characters' | 'draw' | 'reminders';

export const SETUP_STEPS = [
	{ step: 'characters', label: 'setup.step.characters' },
	{ step: 'draw', label: 'setup.step.draw' },
	{ step: 'reminders', label: 'setup.step.reminders' }
] as const satisfies readonly { step: SetupStep; label: MessageKey }[];

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
