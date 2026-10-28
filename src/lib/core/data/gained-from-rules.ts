/**
 * The `gainedFrom` part of a character's rules block: the ability it has is another
 * player's, found on the grimoire (`rules/gained-abilities.ts`).
 * - `token`: its reminder on a player; it has that player's (true) character's ability (the
 *   Cannibal's Lunch, https://wiki.bloodontheclocktower.com/Cannibal; the Pixie's Has Ability,
 *   https://wiki.bloodontheclocktower.com/Pixie; the Philosopher's Drunk,
 *   https://wiki.bloodontheclocktower.com/Philosopher).
 * - `pending`: until `token` is placed, a dead player carrying this reminder gives the ability
 *   if the Storyteller judges it gained (the Pixie's Mad: "if you were mad about being that
 *   character").
 * - `swapped`: a player whose token was swapped for the character they chose has that
 *   character's ability (the Philosopher's Is The Philosopher).
 * - `wakes`: the player then wakes when the gained character would, with its night text
 *   (the Pixie's How to Run).
 */
import { readToken } from './reminder-fields.ts';
import type { ReminderLabel } from './types.ts';
import { checkKeys, describe, isObject, readBoolean, type Issues } from './validate.ts';

export interface GainedFrom {
	token: ReminderLabel;
	pending?: ReminderLabel;
	swapped?: true;
	wakes?: true;
}

/** Reads a `gainedFrom` block; its tokens must be the character's own `reminders`. */
export function readGainedFrom(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): GainedFrom | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'pending', 'swapped', 'wakes'], path, issues);
	if (raw.token === undefined) issues.add(`${path}.token`, 'required');
	const token = readToken(raw, 'token', path, issues, reminders);
	const pending = readToken(raw, 'pending', path, issues, reminders);
	const swapped = readBoolean(raw, 'swapped', path, issues);
	const wakes = readBoolean(raw, 'wakes', path, issues);
	if (token === undefined) return undefined;
	return {
		token,
		...(pending ? { pending } : {}),
		...(swapped ? { swapped: true as const } : {}),
		...(wakes ? { wakes: true as const } : {})
	};
}
