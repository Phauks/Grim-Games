/**
 * The `madness` part of a character's rules block: a player its ability makes "mad" may be
 * executed or die if the Storyteller judges they broke their madness
 * (https://wiki.bloodontheclocktower.com/Madness), so the day view offers that when they do
 * (`rules/madness.ts`). It names a behaviour, never a character:
 * - `token`: the reminder that marks the mad player; without it, this character's own player
 *   is mad (the Mutant, https://wiki.bloodontheclocktower.com/Mutant);
 * - `breaking`: `execution`, the mad player might be executed (the Cerenovus,
 *   https://wiki.bloodontheclocktower.com/Cerenovus), or `death`, they might die (the Harpy,
 *   https://wiki.bloodontheclocktower.com/Harpy);
 * - `alsoDies`: with `death`, the reminder on a second player who might die instead or as
 *   well (the Harpy's 2nd).
 */
import type { ReminderLabel } from './types.ts';
import { readToken } from './reminder-fields.ts';
import { checkKeys, describe, isObject, readEnum, type Issues } from './validate.ts';

export const MADNESS_BREAKING = ['execution', 'death'] as const;
export type MadnessBreaking = (typeof MADNESS_BREAKING)[number];

export interface Madness {
	token?: ReminderLabel;
	breaking: MadnessBreaking;
	alsoDies?: ReminderLabel;
}

/** Reads a `madness` block; its tokens must be among the character's `reminders`. */
export function readMadness(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Madness | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'breaking', 'alsoDies'], path, issues);
	const breaking = readEnum(raw, 'breaking', MADNESS_BREAKING, path, issues, true);
	if (!breaking) return undefined;
	const token = readToken(raw, 'token', path, issues, reminders);
	const alsoDies = readToken(raw, 'alsoDies', path, issues, reminders);
	if (alsoDies && breaking !== 'death')
		issues.add(`${path}.alsoDies`, 'only with breaking "death"');
	return {
		...(token ? { token } : {}),
		breaking,
		...(alsoDies && breaking === 'death' ? { alsoDies } : {})
	};
}
