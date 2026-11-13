/** The special rules the app ships, A–Z by name. */
import type { SpecialRule } from '../types.ts';
import { BINARY_SUPERNOVAE } from './binary-supernovae.ts';
import { COUNCIL_OF_THE_DEAD } from './council-of-the-dead.ts';
import { DJINNS_BARGAIN } from './djinns-bargain.ts';
import { DUPLICATE_CHARACTERS } from './duplicate-characters.ts';
import { ONE_DAY_MORE } from './one-day-more.ts';
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
	ONE_DAY_MORE,
	PHANTOM_DETECTIVES,
	WARRENS,
	TRAINED_KILLER
];

export function specialRuleById(id: string): SpecialRule | undefined {
	return SPECIAL_RULES.find((r) => r.id === id);
}
