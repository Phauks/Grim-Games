/**
 * One part of a character's rules block: a behaviour the rules code knows, which names no
 * character. Each part is one file in this folder, listed once in `index.ts`; the rules block
 * type (`CharacterRules`) and its reader (`parseCharacterRules`) are built from that list, so a
 * new part is a new file and one line there. The Character builder's Rules section lists the
 * parts by `label` and `description`, and edits a part with a `field` through that field (M62).
 */
import type { FieldSpec, SpecValue } from '../field-spec.ts';
import { readSpec } from '../read-spec.ts';
import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import {
	readBoolean,
	readEnum,
	readNumber,
	readString,
	type Issues,
	type Json
} from '../validate.ts';

/** The character's own reminder labels, when known: a part about any other label is an error. */
export type Reminders = readonly ReminderLabel[] | undefined;

/** How the Character builder edits a part's value (`field-spec.ts`); absent: as rules text. */
export type PartField = FieldSpec;

export interface Part<T> {
	/** A short name for the part. */
	label: string;
	/** What the part does, in our own words. */
	description: string;
	/** How the Character builder edits it; absent: as rules text. */
	field?: PartField;
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

/**
 * A part whose shape is its field spec: the builder edits it with `spec`, `readSpec` reads and
 * checks it, and its value's type is the spec's. `refine` adds a check the spec can't say (two
 * settings that go together, a list that needs two or more), recording problems in `issues`;
 * undefined when the value is unusable.
 */
export function specPart<S extends FieldSpec>(
	label: string,
	description: string,
	spec: S,
	refine?: (
		value: SpecValue<S>,
		path: string,
		issues: Issues,
		reminders: Reminders
	) => SpecValue<S> | undefined
): Part<SpecValue<S>> {
	return {
		label,
		description,
		field: spec,
		read: (block, key, path, issues, reminders) => {
			const at = `${path}.${key}`;
			const value = readSpec(spec, block[key], at, issues, reminders);
			return value === undefined || !refine ? value : refine(value, at, issues, reminders);
		}
	};
}

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
		field: { kind: 'boolean' },
		read: (block, key, path, issues) => readBoolean(block, key, path, issues)
	};
}

/** A part that is on when true; false is the same as leaving it out. */
export function truePart(label: string, description: string): Part<true> {
	return {
		label,
		description,
		field: { kind: 'true' },
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
		field: { kind: 'enum', values },
		read: (block, key, path, issues) => readEnum(block, key, values, path, issues, false)
	};
}

/** A whole number above 0: a count, such as how many times a day. */
export function countPart(label: string, description: string): Part<number> {
	return {
		label,
		description,
		field: { kind: 'count' },
		read: (block, key, path, issues) => {
			const n = readNumber(block, key, path, issues);
			if (n === undefined) return undefined;
			if (Number.isInteger(n) && n > 0) return n;
			issues.add(`${path}.${key}`, `expected a whole number above 0, got ${n}`);
			return undefined;
		}
	};
}

/** A text part. */
export function stringPart(label: string, description: string): Part<string> {
	return {
		label,
		description,
		field: { kind: 'string' },
		read: (block, key, path, issues) => readString(block, key, path, issues, false)
	};
}

/** A part naming one of the character's own reminders. */
export function tokenPart(label: string, description: string): Part<ReminderLabel> {
	return {
		label,
		description,
		field: { kind: 'token' },
		read: (block, key, path, issues, reminders) => readToken(block, key, path, issues, reminders)
	};
}
