/**
 * The `counter` part of a character's rules block (plan M53, Trevor 2026-11-04: "certain
 * tokens stack on each other, they are relational ... make these automatically tick up"): a run
 * of the character's own reminders, one for each day or night, that the Storyteller adds as the
 * game goes on. `tokens` lists them in order; `at` says when the next one goes on: `dawn` for a
 * day counter (the Leviathan's and the Riot's Day tokens), `dusk` for a night counter (the
 * Summoner's and the Xaan's Night tokens). `replaces` takes the one before off, for a character
 * that carries only one at a time (the Leviathan). Moved by `rules/counters.ts`, as the
 * Storyteller's setting says.
 */
import type { ReminderLabel } from './types.ts';
import { ownReminder } from './reminder-fields.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readStringArray,
	type Issues
} from './validate.ts';

export const COUNTER_TIMES = ['dawn', 'dusk'] as const;
export type CounterTime = (typeof COUNTER_TIMES)[number];

export interface Counter {
	tokens: readonly ReminderLabel[];
	at: CounterTime;
	replaces?: true;
}

/** Reads a `counter` block: two or more of the character's own reminders, and when. */
export function readCounter(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Counter | undefined {
	if (raw === undefined) return undefined;
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['tokens', 'at', 'replaces'], path, issues);
	const tokens = readStringArray(raw, 'tokens', path, issues);
	const at = readEnum(raw, 'at', COUNTER_TIMES, path, issues, true);
	const replaces = readBoolean(raw, 'replaces', path, issues);
	if (!tokens || tokens.length < 2) {
		issues.add(`${path}.tokens`, 'expected two or more reminders, in the order placed');
		return undefined;
	}
	const foreign = tokens.filter((t) => !ownReminder(t, reminders));
	if (foreign.length) {
		issues.add(`${path}.tokens`, `not this character’s reminders: ${foreign.join(', ')}`);
		return undefined;
	}
	if (!at) return undefined;
	return { tokens: tokens as ReminderLabel[], at, ...(replaces ? { replaces: true } : {}) };
}
