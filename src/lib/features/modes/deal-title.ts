/**
 * The deal screen's title, known before the game opens (the route passes it to WithGame
 * so nothing moves while loading): Draft for a draft mode, Choose characters otherwise.
 */
import { findMode } from './custom-modes.svelte.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { readGameMode } from './game-mode-store.ts';

export function dealTitle(gameId: GameId): string {
	const mode = findMode(readGameMode(gameId)?.modeId ?? '');
	return mode?.parts.assignment?.kind === 'draft'
		? t('modes.deal.draftHeading')
		: t('modes.deal.chooseHeading');
}
