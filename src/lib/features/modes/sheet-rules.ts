import { STANDARD, type GameMode, type SpecialRule } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { PublicRule } from '#lib/core/sync/public-projection.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';
import { shownAbout } from './own-wording.svelte.ts';

/**
 * What a copy of the script lists under Jinxes (Trevor, 2026-10-24: "any special game mode or
 * special rules should popualte as well. Perhaps a new section beneath Jinx, for all
 * screens"): the mode unless Standard, then each rule, with the About text it may show.
 */
export function sheetRules(mode: GameMode, rules: readonly SpecialRule[]): PublicRule[] {
	return [...(mode.id === STANDARD.id ? [] : [mode]), ...rules].map((m) => {
		const text = shownAbout(m);
		return { id: m.id, name: m.name, ...(text ? { text } : {}) };
	});
}

/** The same for a game, from the mode it was started in. */
export function gameSheetRules(gameId: GameId): PublicRule[] {
	const record = readGameMode(gameId);
	if (!record) return [];
	return sheetRules(findMode(record.modeId) ?? STANDARD, record.rules);
}
