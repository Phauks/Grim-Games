import { checkKeys, describe, isObject, readBoolean, readString } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * A count the Storyteller keeps of something its player does by day (`dayTally`), starting
 * at none each day: `label` names it on the day view; with `kills`, each one lets its ability
 * kill one player, by day or that night, with the character as the death cause (the
 * Yaggababble's phrase said aloud, https://wiki.bloodontheclocktower.com/Yaggababble). Read
 * by `rules/day-tally.ts`.
 */
export interface DayTally {
	label: string;
	kills?: true;
}

/** A count of times today (Trevor, 2026-11-02: M17c). */
export const dayTally = objectPart(
	'Day tally',
	'A count the Storyteller keeps of times its player does something today.',
	(raw, path, issues): DayTally | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['label', 'kills'], path, issues);
		const label = readString(raw, 'label', path, issues, true);
		const kills = readBoolean(raw, 'kills', path, issues);
		if (kills === false) issues.add(`${path}.kills`, 'expected true');
		if (!label) return undefined;
		return { label, ...(kills ? { kills: true as const } : {}) };
	}
);
