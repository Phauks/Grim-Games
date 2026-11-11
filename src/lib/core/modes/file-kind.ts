/**
 * What a mode or rule file is, from its parts alone (Trevor, 2026-11-01: one format for game
 * modes and special rules, labelled by the app). A file that sets up or deals the whole game
 * is a game mode, of which a game has one; any other only adds to a game, so it is a special
 * rule and several can stack. A `kind` written in the file is not read for this.
 */
import { isObject } from '#lib/core/data/validate.ts';
import {
	RULE_ONLY_SECTIONS,
	WHOLE_GAME_SECTIONS,
	type GameMode,
	type RuleSetup,
	type SpecialRule,
	type WholeGameSection
} from './types.ts';

export type FileKind = 'game-mode' | 'special-rule';

/** Pools that keep the chosen script, which a special rule may set. */
const SCRIPT_POOLS: readonly unknown[] = ['script', 'script-plus-hidden'];

/** The parts that make this file a game mode, in the guide's order (`pool` for a pool of its own). */
export function wholeGamePartsOf(file: unknown): (WholeGameSection | 'pool')[] {
	const setup = isObject(file) && isObject(file.setup) ? file.setup : {};
	const found: (WholeGameSection | 'pool')[] = [];
	if (isObject(setup.pool) && !SCRIPT_POOLS.includes(setup.pool.kind)) found.push('pool');
	for (const part of WHOLE_GAME_SECTIONS) if (setup[part] !== undefined) found.push(part);
	return found;
}

export function fileKind(file: unknown): FileKind {
	return wholeGamePartsOf(file).length > 0 ? 'game-mode' : 'special-rule';
}

/**
 * A game mode's rule parts and rules block as a special rule of its own (same id and name), for
 * the screens that read a game's rules list (night wakes, nominations, abilities). Undefined
 * when the mode sets none of them.
 */
export function modeRule(mode: GameMode): SpecialRule | undefined {
	const setup = Object.fromEntries(
		RULE_ONLY_SECTIONS.flatMap((part) =>
			mode.setup[part] === undefined ? [] : [[part, mode.setup[part]]]
		)
	) as RuleSetup;
	if (Object.keys(setup).length === 0 && !mode.rules) return undefined;
	return {
		kind: 'special-rule',
		format: mode.format,
		id: mode.id,
		name: mode.name,
		sources: mode.sources,
		setup,
		...(mode.rules ? { rules: mode.rules } : {})
	};
}
