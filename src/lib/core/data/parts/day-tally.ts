import { obj, opt, STR, T } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * A count the Storyteller keeps of something its player does by day (`dayTally`), starting
 * at none each day: `label` names it on the day view; with `kills`, each one lets its ability
 * kill one player, by day or that night, with the character as the death cause (the
 * Yaggababble's phrase said aloud, https://wiki.bloodontheclocktower.com/Yaggababble). Read
 * by `rules/day/day-tally.ts` (Trevor, 2026-11-02: M17c).
 */
export const dayTally = specPart(
	'Day tally',
	'A count the Storyteller keeps of times its player does something today.',
	obj({ label: STR, kills: opt(T) })
);

export type DayTally = PartValue<typeof dayTally>;
