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
import {
	ALIGNMENTS,
	SEATED_TYPES,
	type Alignment,
	type CharacterId,
	type ReminderLabel,
	type SeatedType
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readStringArray,
	type Issues
} from './validate.ts';
import { readToken } from './reminder-fields.ts';

const BECOMES_INTO = ['demon', 'evil', 'swap'] as const;
const BECOMES_WHEN = ['placed', 'removed'] as const;

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

/**
 * The `changesCharacter` part: on its night step, this character's living player chooses a
 * player who becomes a character the step then picks. It names a behaviour, never a
 * character's rules:
 * - `types`: the character types that may be picked;
 * - `notInPlay`: only characters no one is playing (the Pit-Hag,
 *   https://wiki.bloodontheclocktower.com/Pit-Hag);
 * - `alignment`: the player's new alignment; left out, they keep theirs (the Summoner's
 *   "evil Demon", https://wiki.bloodontheclocktower.com/Summoner);
 * - `token`: only on a night its own token marks (the Summoner's Night 3);
 * - `spent`: not once its own token says it was used (the Huntsman's No Ability);
 * - `onlyFrom`: only a player of one of these characters changes (the Huntsman's Damsel,
 *   https://wiki.bloodontheclocktower.com/Huntsman).
 */
export interface ChangesCharacter {
	types: readonly SeatedType[];
	notInPlay?: true;
	alignment?: Alignment;
	token?: ReminderLabel;
	spent?: ReminderLabel;
	onlyFrom?: readonly CharacterId[];
}

/** Reads a `changesCharacter` block; its tokens must be among the character's `reminders`. */
export function readChangesCharacter(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ChangesCharacter | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['types', 'notInPlay', 'alignment', 'token', 'spent', 'onlyFrom'], path, issues);
	const types = (readStringArray(raw, 'types', path, issues) ?? []).filter((t, i) => {
		const ok = (SEATED_TYPES as readonly string[]).includes(t);
		if (!ok) issues.add(`${path}.types[${i}]`, `unknown value ${JSON.stringify(t)}`);
		return ok;
	}) as SeatedType[];
	if (types.length === 0) issues.add(`${path}.types`, 'expected at least one character type');
	const notInPlay = readBoolean(raw, 'notInPlay', path, issues);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const token = readToken(raw, 'token', path, issues, reminders);
	const spent = readToken(raw, 'spent', path, issues, reminders);
	const onlyFrom = readStringArray(raw, 'onlyFrom', path, issues);
	if (types.length === 0) return undefined;
	return {
		types,
		...(notInPlay ? { notInPlay: true as const } : {}),
		...(alignment ? { alignment } : {}),
		...(token ? { token } : {}),
		...(spent ? { spent } : {}),
		...(onlyFrom?.length ? { onlyFrom } : {})
	};
}
