/**
 * The `stopsWaking` part of a character's rules block: its reminder token on a player stops
 * that player waking for their own ability tonight, only a `type` player when given (the
 * Exorcist's Chosen on the Demon, https://wiki.bloodontheclocktower.com/Exorcist). Shown at
 * the stopped step (`rules/night-alerts.ts`).
 */
import { CHARACTER_TYPES, type CharacterType, type ReminderLabel } from './types.ts';
import { checkKeys, describe, isObject, readEnum, type Issues } from './validate.ts';
import { readToken } from './reminder-fields.ts';

export interface StopsWaking {
	token: ReminderLabel;
	type?: CharacterType;
}

/** Reads a `stopsWaking` block; `token` must be one of the character's `reminders`. */
export function readStopsWaking(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): StopsWaking | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'type'], path, issues);
	const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
	if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
	const token = readToken(raw, 'token', path, issues, reminders);
	if (token === undefined) return undefined;
	return { token, ...(type ? { type } : {}) };
}
