/**
 * A saved game's mode as it plays: the mode it was started in with its special rules folded
 * in (combineRules), so the deal, hidden characters, Specters and the Demon's bluffs all read
 * one set of parts.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { AnyDuplicates } from '#lib/core/rules/index.ts';
import {
	allowedOffScript,
	modeRule,
	STANDARD,
	withRules,
	type CombinedParts,
	type GameMode,
	type SpecialRule
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

/**
 * The rules a game plays by, for the screens that read a rules list (night steps, nominations,
 * abilities): the mode's own rule parts first, as a rule of its own (`modeRule`, Trevor
 * 2026-11-01: one format for modes and rules), then the special rules chosen. The game keeps
 * only the chosen ones (game-mode-store.ts), so the mode's never shows as a rule to turn off.
 */
export function playedRules(gameId: GameId): SpecialRule[] {
	const record = readGameMode(gameId);
	if (!record) return [];
	const own = modeRule(findMode(record.modeId) ?? STANDARD);
	return [...(own ? [own] : []), ...record.rules];
}

/**
 * The characters this game's mode or rules let have several copies (Duplicate Characters,
 * Whale Buffet): every type but those named; undefined when only their own rules allow it.
 */
export function duplicatesAllowedIn(gameId: GameId): AnyDuplicates | undefined {
	const duplicates = gameModeOf(gameId)?.parts.duplicates;
	return duplicates?.kind === 'allowed' ? { notTypes: duplicates.notTypes } : undefined;
}

/** The characters this game's rules put in play from off the script (+1, Infinite Possibilities). */
export function allowedOffScriptIn(gameId: GameId): ReadonlySet<CharacterId> {
	const mode = gameModeOf(gameId);
	return mode ? allowedOffScript(mode, readExtras(gameId) ?? []) : new Set();
}
