/**
 * What a mode or rule file is, from its parts alone (Trevor, 2026-11-01: one format for game
 * modes and special rules, labelled by the app). A file that sets up or deals the whole game
 * is a game mode, of which a game has one; any other only adds to a game, so it is a special
 * rule and several can stack. A `kind` written in the file is not read for this.
 */
import { isObject } from '#lib/core/data/validate.ts';
import {
	RULE_ONLY_PARTS,
	WHOLE_GAME_PARTS,
	type GameMode,
	type RuleOnlyParts,
	type SpecialRule,
	type WholeGamePart
} from './types.ts';

export type FileKind = 'game-mode' | 'special-rule';

/** Pools that keep the chosen script, which a special rule may set. */
const SCRIPT_POOLS: readonly unknown[] = ['script', 'script-plus-hidden'];

/** The parts that make this file a game mode, in the guide's order (`pool` for a pool of its own). */
export function wholeGamePartsOf(file: unknown): (WholeGamePart | 'pool')[] {
	const parts = isObject(file) && isObject(file.parts) ? file.parts : {};
	const found: (WholeGamePart | 'pool')[] = [];
	if (isObject(parts.pool) && !SCRIPT_POOLS.includes(parts.pool.kind)) found.push('pool');
	for (const part of WHOLE_GAME_PARTS) if (parts[part] !== undefined) found.push(part);
	return found;
}

export function fileKind(file: unknown): FileKind {
	return wholeGamePartsOf(file).length > 0 ? 'game-mode' : 'special-rule';
}

/**
 * A game mode's rule parts as a special rule of its own (same id and name), for the screens
 * that read a game's rules list (night steps, nominations, abilities). Undefined when the mode
 * sets none of them.
 */
export function modeRule(mode: GameMode): SpecialRule | undefined {
	const parts = Object.fromEntries(
		RULE_ONLY_PARTS.flatMap((part) =>
			mode.parts[part] === undefined ? [] : [[part, mode.parts[part]]]
		)
	) as RuleOnlyParts;
	if (Object.keys(parts).length === 0) return undefined;
	return {
		kind: 'special-rule',
		format: mode.format,
		id: mode.id,
		name: mode.name,
		sources: mode.sources,
		parts
	};
}
