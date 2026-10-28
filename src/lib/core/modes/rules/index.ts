/** The special rules the app ships, A–Z by name. */
import type { SpecialRule } from '../types.ts';
import { BINARY_SUPERNOVAE } from './binary-supernovae.ts';
import { COUNCIL_OF_THE_DEAD } from './council-of-the-dead.ts';
import { DJINNS_BARGAIN } from './djinns-bargain.ts';
import { DUPLICATE_CHARACTERS } from './duplicate-characters.ts';
import { PHANTOM_DETECTIVES } from './phantom-detectives.ts';
import { TRAINED_KILLER } from './trained-killer.ts';
import { INFINITE_POSSIBILITIES } from './infinite-possibilities.ts';
import { I_SEE_DEAD_PEOPLE } from './i-see-dead-people.ts';
import { PLUS_ONE } from './plus-one.ts';
import { SEAT_7 } from './seat-7.ts';
import { SPECTERS } from './specters.ts';
import { STOWED_AWAY } from './stowed-away.ts';
import { WARRENS } from './warrens.ts';

export { INFINITE_POSSIBILITIES, SPECTERS };

export const SPECIAL_RULES: readonly SpecialRule[] = [
	PLUS_ONE,
	BINARY_SUPERNOVAE,
	COUNCIL_OF_THE_DEAD,
	DUPLICATE_CHARACTERS,
	INFINITE_POSSIBILITIES,
	I_SEE_DEAD_PEOPLE,
	SPECTERS,
	STOWED_AWAY,
	SEAT_7,
	DJINNS_BARGAIN,
	PHANTOM_DETECTIVES,
	WARRENS,
	TRAINED_KILLER
];

/**
 * Game modes that became special rules (Trevor, 2026-10-18), by id: a game saved in one of
 * them reads as Standard with that rule.
 */
const MODES_NOW_RULES: readonly string[] = ['specters', 'infinite-possibilities'];

/** A saved game's mode and rules, with a mode that became a rule read as Standard plus it. */
export function upgradeModeChoice(
	modeId: string,
	ruleIds: readonly string[] = []
): { modeId: string; ruleIds: string[] } {
	if (!MODES_NOW_RULES.includes(modeId)) return { modeId, ruleIds: [...ruleIds] };
	return { modeId: 'standard', ruleIds: [modeId, ...ruleIds.filter((id) => id !== modeId)] };
}

export function specialRuleById(id: string): SpecialRule | undefined {
	return SPECIAL_RULES.find((r) => r.id === id);
}
