/**
 * A yes-or-no fact about today that the Storyteller marks by hand, because the app does not
 * track it, and that a character learns at night: the `dayMark` part of its rules block, read
 * here and used by `rules/day-marks.ts`, the day view and End day.
 *
 * - `mark`: which fact (`DAY_MARKS`): `demon-voted` (the Flowergirl,
 *   https://wiki.bloodontheclocktower.com/Flowergirl) or `minion-nominated` (the Town Crier,
 *   https://wiki.bloodontheclocktower.com/Town_Crier);
 * - `yes`, `no`: the character's own reminder tokens that show the fact on its seat. Marking
 *   the fact places the matching one and takes the other off, as the wiki's How to Run does
 *   with the two tokens each day.
 *
 * While such a character is in play, End day asks for any of today's marks still unset.
 */
import type { ReminderLabel } from './types.ts';
import { checkKeys, describe, isObject, readEnum, readString, type Issues } from './validate.ts';

export const DAY_MARKS = ['demon-voted', 'minion-nominated'] as const;
export type DayMark = (typeof DAY_MARKS)[number];

export interface DayMarkRule {
	mark: DayMark;
	yes: ReminderLabel;
	no: ReminderLabel;
}

/** Reads a `dayMark` block; `reminders` are the character's own labels, when given. */
export function readDayMark(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): DayMarkRule | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['mark', 'yes', 'no'], path, issues);
	const mark = readEnum(raw, 'mark', DAY_MARKS, path, issues, true);
	const tokens: Partial<Record<'yes' | 'no', ReminderLabel>> = {};
	for (const key of ['yes', 'no'] as const) {
		const label = readString(raw, key, path, issues, true);
		if (label !== undefined && reminders && !reminders.includes(label)) {
			issues.add(`${path}.${key}`, 'not one of this character’s reminders');
		}
		if (label !== undefined) tokens[key] = label;
	}
	if (tokens.yes !== undefined && tokens.yes === tokens.no) {
		issues.add(`${path}.no`, 'the same token as yes');
	}
	if (!mark || tokens.yes === undefined || tokens.no === undefined) return undefined;
	return { mark, yes: tokens.yes, no: tokens.no };
}
