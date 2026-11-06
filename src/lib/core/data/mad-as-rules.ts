/**
 * The `madAs` part of a character's rules block: the character a player is mad as, by this
 * character's token (https://wiki.bloodontheclocktower.com/Madness), shown by the mad
 * player's seat on the board marked ! (Trevor, 2026-11-03, M36). It names a behaviour, never a
 * character:
 * - `token`: the reminder it is found by;
 * - `mad: "carrier"`: the player carrying the token is mad as a character recorded on it,
 *   chosen from `choose` types on this character's night step (the Cerenovus,
 *   https://wiki.bloodontheclocktower.com/Cerenovus), and also any of `characters`, whatever
 *   their type (with its jinx, the Cerenovus may choose the Goblin);
 * - `mad: "self"`: this character's own player is mad as the character of the player carrying
 *   the token (the Pixie, https://wiki.bloodontheclocktower.com/Pixie).
 */
import { readToken } from './reminder-fields.ts';
import { SEATED_TYPES, type CharacterId, type ReminderLabel, type SeatedType } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readEnum,
	readStringArray,
	type Issues
} from './validate.ts';

export const MAD_AS_WHO = ['carrier', 'self'] as const;
export type MadAsWho = (typeof MAD_AS_WHO)[number];

export interface MadAs {
	token: ReminderLabel;
	mad: MadAsWho;
	/** With `mad: "carrier"`: the types the character is chosen from. */
	choose?: readonly SeatedType[];
	/** With `mad: "carrier"`: characters it may also be, whatever their type. */
	characters?: readonly CharacterId[];
}

/** Reads a `madAs` block; its token must be among the character's `reminders`. */
export function readMadAs(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): MadAs | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'mad', 'choose', 'characters'], path, issues);
	if (raw.token === undefined) issues.add(`${path}.token`, 'required');
	const token = readToken(raw, 'token', path, issues, reminders);
	const mad = readEnum(raw, 'mad', MAD_AS_WHO, path, issues, true);
	const choose = readStringArray(raw, 'choose', path, issues);
	const bad = (choose ?? []).filter((t) => !(SEATED_TYPES as readonly string[]).includes(t));
	if (bad.length > 0) issues.add(`${path}.choose`, `expected types, got ${bad.join(', ')}`);
	if (choose && mad === 'self') issues.add(`${path}.choose`, 'only with mad "carrier"');
	if (mad === 'carrier' && !choose) issues.add(`${path}.choose`, 'required with mad "carrier"');
	const also = readStringArray(raw, 'characters', path, issues);
	if (also && mad !== 'carrier') issues.add(`${path}.characters`, 'only with mad "carrier"');
	if (token === undefined || mad === undefined) return undefined;
	return {
		token,
		mad,
		...(mad === 'carrier' && choose && choose.length > 0 && bad.length === 0
			? { choose: choose as readonly SeatedType[] }
			: {}),
		...(mad === 'carrier' && also && also.length > 0 ? { characters: also } : {})
	};
}
