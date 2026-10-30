/**
 * The deal screen's title, known before the game opens (the route passes it to WithGame
 * so nothing moves while loading): Draft for a draft mode, Choose characters otherwise.
 */
import type { GameId } from '#lib/core/model/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { gameModeOf } from './game-mode.ts';

export function dealTitle(gameId: GameId): string {
	const mode = gameModeOf(gameId);
	return mode?.parts.assignment?.kind === 'draft'
		? t('modes.deal.draftHeading')
		: t('modes.deal.chooseHeading');
}

/** Draft or Choose characters for a mode that deals no bag (Sushi Buffet, Whale Buffet). */
export function dealStep(gameId: GameId): string | undefined {
	const kind = gameModeOf(gameId)?.parts.assignment?.kind;
	return kind === 'draft' || kind === 'choose-own' ? dealTitle(gameId) : undefined;
}
