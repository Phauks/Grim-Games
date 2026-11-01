/**
 * The `countdown` part of a character's rules block: a reminder token that counts down one
 * step each night, so an effect lasts a set number of nights and days. `tokens` lists the
 * labels in the order they are placed: each night the token on a player is swapped for the
 * next, and the last one comes off. The Courtier's drunkenness lasts 3 nights and 3 days
 * (https://wiki.bloodontheclocktower.com/Courtier), marked Drunk 3, then Drunk 2, then Drunk 1,
 * as its night text says. Shown at the character's night step (`rules/countdown.ts`).
 */
import type { ReminderLabel } from './types.ts';
import { ownReminder } from './reminder-fields.ts';
import { checkKeys, describe, isObject, readStringArray, type Issues } from './validate.ts';

export interface Countdown {
	tokens: readonly ReminderLabel[];
}

/**
 * Reads a `countdown` block: two or more of the character's own reminders, in order.
 * Undefined when absent.
 */
export function readCountdown(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Countdown | undefined {
	if (raw === undefined) return undefined;
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['tokens'], path, issues);
	const tokens = readStringArray(raw, 'tokens', path, issues);
	if (!tokens || tokens.length < 2) {
		issues.add(`${path}.tokens`, 'expected two or more reminders, in the order placed');
		return undefined;
	}
	const foreign = tokens.filter((t) => !ownReminder(t, reminders));
	if (foreign.length) {
		issues.add(`${path}.tokens`, `not this character’s reminders: ${foreign.join(', ')}`);
		return undefined;
	}
	return { tokens };
}
