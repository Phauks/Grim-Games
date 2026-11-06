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
 * - `ifEvil`: their own reminder, placed on themselves when the player carrying `token` is evil:
 *   they are impaired by it, and their step only reminds the Storyteller of that (the
 *   Cannibal's Poisoned, https://wiki.bloodontheclocktower.com/Cannibal#How_to_Run).
 * - `choose`: the player chooses a character of these types whose ability they gain (the
 *   Philosopher's good character). Its night step offers the pick: a character in play puts
 *   `token` on its player; any other is held by the player (`Seat.abilities`, via this
 *   character), whose token stays as it is (Trevor, 2026-11-03).
 */
import { readToken } from './reminder-fields.ts';
import { SEATED_TYPES, type ReminderLabel, type SeatedType } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readStringArray,
	type Issues
} from './validate.ts';

export interface GainedFrom {
	token: ReminderLabel;
	pending?: ReminderLabel;
	swapped?: true;
	wakes?: true;
	ifEvil?: ReminderLabel;
	choose?: readonly SeatedType[];
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
	checkKeys(raw, ['token', 'pending', 'swapped', 'wakes', 'ifEvil', 'choose'], path, issues);
	if (raw.token === undefined) issues.add(`${path}.token`, 'required');
	const token = readToken(raw, 'token', path, issues, reminders);
	const pending = readToken(raw, 'pending', path, issues, reminders);
	const swapped = readBoolean(raw, 'swapped', path, issues);
	const wakes = readBoolean(raw, 'wakes', path, issues);
	const ifEvil = readToken(raw, 'ifEvil', path, issues, reminders);
	const choose = readStringArray(raw, 'choose', path, issues);
	const bad = (choose ?? []).filter((t) => !(SEATED_TYPES as readonly string[]).includes(t));
	if (bad.length > 0) issues.add(`${path}.choose`, `expected types, got ${bad.join(', ')}`);
	if (token === undefined) return undefined;
	return {
		token,
		...(pending ? { pending } : {}),
		...(swapped ? { swapped: true as const } : {}),
		...(wakes ? { wakes: true as const } : {}),
		...(ifEvil ? { ifEvil } : {}),
		...(choose && choose.length > 0 && bad.length === 0
			? { choose: choose as readonly SeatedType[] }
			: {})
	};
}
