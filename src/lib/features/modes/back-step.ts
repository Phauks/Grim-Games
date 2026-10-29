import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { GameId } from '#lib/core/model/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { backToNewGame, saveDraft } from './new-game-draft.ts';
import { stepBeforeSetup } from './start.ts';

/**
 * Back from the screen where characters are chosen (Character selection, a mode's deal) while
 * the game hasn't begun: a rule's hidden characters where it adds them, else New game, which
 * keeps this screen's player count for the next game (Trevor, 2026-10-28).
 */
export async function backFromSetup(gameId: GameId, players?: number): Promise<void> {
	if (stepBeforeSetup(gameId) === 'new') return backToNewGame(gameId, players);
	if (players) saveDraft({ players });
	await goto(resolve('/grimoire/[gameId]/extras', { gameId }));
}

/** The name on that Back. */
export function backFromSetupLabel(gameId: GameId): string {
	return stepBeforeSetup(gameId) === 'new' ? t('setup.newGame') : t('modes.extras.title');
}
