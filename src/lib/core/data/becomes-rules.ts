/**
 * The `becomes` part of a character's rules block: its reminder token says a player changed
 * character or alignment, so the board offers to make that change (`rules/becomes.ts`). It
 * names a behaviour, never a character:
 * - `demon`: the carrier becomes the Demon in play, the dead one first, and is evil (the
 *   Scarlet Woman's Is The Demon, https://wiki.bloodontheclocktower.com/Scarlet_Woman);
 * - `evil`: the carrier turns evil (the Mezepheles's Turns Evil, taken off on the night they
 *   turn, https://wiki.bloodontheclocktower.com/Mezepheles);
 * - `swap`: a Demon carrier swaps characters and alignments with this character's player (the
 *   Snake Charmer's Poisoned on the Demon it chose,
 *   https://wiki.bloodontheclocktower.com/Snake_Charmer).
 *
 * `when` is the moment the token says so: `placed` (the default) or `removed`.
 */
import type { ReminderLabel } from './types.ts';
import { checkKeys, describe, isObject, readEnum, type Issues } from './validate.ts';
import { readToken } from './reminder-fields.ts';

export const BECOMES_INTO = ['demon', 'evil', 'swap'] as const;
export const BECOMES_WHEN = ['placed', 'removed'] as const;

export interface Becomes {
	token: ReminderLabel;
	into: (typeof BECOMES_INTO)[number];
	when?: 'removed';
}

/** Reads a `becomes` block; `token` must be one of the character's `reminders`. */
export function readBecomes(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Becomes | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'into', 'when'], path, issues);
	if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
	const token = readToken(raw, 'token', path, issues, reminders);
	const into = readEnum(raw, 'into', BECOMES_INTO, path, issues, true);
	const when = readEnum(raw, 'when', BECOMES_WHEN, path, issues, false);
	if (token === undefined || into === undefined) return undefined;
	return { token, into, ...(when === 'removed' ? { when } : {}) };
}
