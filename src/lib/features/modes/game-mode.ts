/**
 * A saved game's mode as it plays: the mode it was started in with its special rules folded
 * in (combineRules), so the deal, hidden characters, Specters and the Demon's bluffs all read
 * one set of parts.
 */
import { STANDARD, withRules, type CombinedParts, type GameMode } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';

/** The game's mode with its rules; undefined for a game started without one (standard). */
export function gameModeOf(gameId: GameId): (GameMode & { parts: CombinedParts }) | undefined {
	const record = readGameMode(gameId);
	if (!record) return undefined;
	return withRules(findMode(record.modeId) ?? STANDARD, record.rules);
}
