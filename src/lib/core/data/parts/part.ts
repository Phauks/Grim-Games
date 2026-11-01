/**
 * One part of a character's rules block: a behaviour the rules code knows, which names no
 * character. Each part is one file in this folder, listed once in `index.ts`; the rules block
 * type (`CharacterRules`) and its reader (`parseCharacterRules`) are built from that list, so a
 * new part is a new file and one line there. A custom character builder can list the parts with
 * their `label` and `description` (not shown in the app yet).
 */
import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { readBoolean, readEnum, readString, type Issues, type Json } from '../validate.ts';

/** The character's own reminder labels, when known: a part about any other label is an error. */
export type Reminders = readonly ReminderLabel[] | undefined;

export interface Part<T> {
	/** A short name for the part. */
	label: string;
	/** What the part does, in our own words. */
	description: string;
	/**
	 * Reads the part's value from `block[key]` (present), recording each problem in `issues`
	 * under `path` (the block's path). Undefined when the value is unusable.
	 */
	read: (
		block: Json,
		key: string,
		path: string,
		issues: Issues,
		reminders: Reminders
	) => T | undefined;
}

/** The value a part reads. */
export type PartValue<P> = P extends Part<infer T> ? T : never;

/** A part whose value is read by `reader(value, path.key, issues, reminders)`. */
export function objectPart<T>(
	label: string,
	description: string,
	reader: (raw: unknown, path: string, issues: Issues, reminders: Reminders) => T | undefined
): Part<T> {
	return {
		label,
		description,
		read: (block, key, path, issues, reminders) =>
			reader(block[key], `${path}.${key}`, issues, reminders)
	};
}

/** A true or false part. */
export function booleanPart(label: string, description: string): Part<boolean> {
	return {
		label,
		description,
		read: (block, key, path, issues) => readBoolean(block, key, path, issues)
	};
}

/** A part that is on when true; false is the same as leaving it out. */
export function truePart(label: string, description: string): Part<true> {
	return {
		label,
		description,
		read: (block, key, path, issues) => (readBoolean(block, key, path, issues) ? true : undefined)
	};
}

/** A part that is one of `values`. */
export function enumPart<T extends string>(
	label: string,
	description: string,
	values: readonly T[]
): Part<T> {
	return {
		label,
		description,
		read: (block, key, path, issues) => readEnum(block, key, values, path, issues, false)
	};
}

/** A text part. */
export function stringPart(label: string, description: string): Part<string> {
	return {
		label,
		description,
		read: (block, key, path, issues) => readString(block, key, path, issues, false)
	};
}

/** A part naming one of the character's own reminders. */
export function tokenPart(label: string, description: string): Part<ReminderLabel> {
	return {
		label,
		description,
		read: (block, key, path, issues, reminders) => readToken(block, key, path, issues, reminders)
	};
}
