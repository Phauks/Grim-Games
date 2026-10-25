/**
 * A saved game's mode as it plays: the mode it was started in with its special rules folded
 * in (combineRules), so the deal, hidden characters, Specters and the Demon's bluffs all read
 * one set of parts.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import {
	allowedOffScript,
	STANDARD,
	withRules,
	type CombinedParts,
	type GameMode
} from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';
import { readExtras } from './mode-extras.ts';

/** The game's mode with its rules; undefined for a game started without one (standard). */
export function gameModeOf(gameId: GameId): (GameMode & { parts: CombinedParts }) | undefined {
	const record = readGameMode(gameId);
	if (!record) return undefined;
	return withRules(findMode(record.modeId) ?? STANDARD, record.rules);
}

/** The characters this game's rules put in play from off the script (+1, Infinite Possibilities). */
export function allowedOffScriptIn(gameId: GameId): ReadonlySet<CharacterId> {
	const mode = gameModeOf(gameId);
	return mode ? allowedOffScript(mode, readExtras(gameId) ?? []) : new Set();
}
