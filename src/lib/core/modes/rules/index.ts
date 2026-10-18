/** The special rules the app ships, A–Z by name. */
import type { SpecialRule } from '../types.ts';
import { I_SEE_DEAD_PEOPLE } from './i-see-dead-people.ts';
import { SEAT_7 } from './seat-7.ts';
import { STOWED_AWAY } from './stowed-away.ts';

export const SPECIAL_RULES: readonly SpecialRule[] = [I_SEE_DEAD_PEOPLE, STOWED_AWAY, SEAT_7];

export function specialRuleById(id: string): SpecialRule | undefined {
	return SPECIAL_RULES.find((r) => r.id === id);
}
