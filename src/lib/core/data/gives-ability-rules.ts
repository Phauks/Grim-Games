/**
 * The `givesAbility` part of a character's rules block: it gives another player an ability
 * they hold without its token (`Seat.abilities`, `rules/gained-abilities.ts`). The
 * Storyteller picks the ability from the seat's ⋯ menu. It names a behaviour, never a
 * character:
 * - `to`: who holds it; `demon`, the Demon in play (the Boffin,
 *   https://wiki.bloodontheclocktower.com/Boffin), `storyteller`, the Storyteller, who
 *   makes its choices (the Plague Doctor, picked on its night step once it dies,
 *   https://wiki.bloodontheclocktower.com/Plague_Doctor), or `self`, this character's own
 *   player (the Hermit, https://wiki.bloodontheclocktower.com/Hermit; picked from its own ⋯
 *   menu without `onScript`: the character whose ability the Amnesiac's works like, for its
 *   night timing, text and reminders, https://wiki.bloodontheclocktower.com/Amnesiac);
 * - `types`: the character types the ability may come from;
 * - `onScript`: every other character of those types on the script, all at once, with
 *   nothing to pick (the Hermit's Outsiders);
 * - `notInPlay`: only a character not in play;
 * - `token`: its reminder that marks the held ability on the board (the Plague Doctor's
 *   Storyteller Ability);
 * - `whileWorks`: the holder has it only while this character's ability works, so not while
 *   its player is dead, drunk or poisoned (the Boffin's Summary on the wiki);
 * - `setup`: the setup change in brackets on the given ability is made, as if its character
 *   were in play (the Boffin's How to Run: the Demon's two abilities change setup);
 * - `standIns`: this character's own reminders that stand in for the given abilities' tokens
 *   (the Hermit's 1, 2 and 3). The app gives each holder its own copies of the real tokens
 *   instead (M68, Trevor 2026-11-06), so it never offers these.
 */
import { readToken } from './reminder-fields.ts';
import { SEATED_TYPES, type ReminderLabel, type SeatedType } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readStringArray,
	type Issues
} from './validate.ts';

export const GIVES_ABILITY_TO = ['demon', 'storyteller', 'self'] as const;
export type GivesAbilityTo = (typeof GIVES_ABILITY_TO)[number];

export interface GivesAbility {
	to: GivesAbilityTo;
	types: readonly SeatedType[];
	notInPlay?: true;
	onScript?: true;
	token?: ReminderLabel;
	whileWorks?: true;
	setup?: true;
	standIns?: readonly ReminderLabel[];
}

/** Reads a `givesAbility` block. */
export function readGivesAbility(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): GivesAbility | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		['to', 'types', 'notInPlay', 'onScript', 'token', 'whileWorks', 'setup', 'standIns'],
		path,
		issues
	);
	const to = readEnum(raw, 'to', GIVES_ABILITY_TO, path, issues, true);
	const types = (readStringArray(raw, 'types', path, issues) ?? []).filter((t, i) => {
		const ok = (SEATED_TYPES as readonly string[]).includes(t);
		if (!ok) issues.add(`${path}.types[${i}]`, `unknown value ${JSON.stringify(t)}`);
		return ok;
	}) as SeatedType[];
	if (types.length === 0) issues.add(`${path}.types`, 'expected at least one character type');
	const notInPlay = readBoolean(raw, 'notInPlay', path, issues);
	const onScript = readBoolean(raw, 'onScript', path, issues);
	if (onScript && to !== 'self') issues.add(`${path}.onScript`, 'only with "to": "self"');
	const whileWorks = readBoolean(raw, 'whileWorks', path, issues);
	const setup = readBoolean(raw, 'setup', path, issues);
	const token = readToken(raw, 'token', path, issues, reminders);
	const standIns = readStringArray(raw, 'standIns', path, issues);
	standIns?.forEach((label, i) => {
		if (reminders && !reminders.includes(label))
			issues.add(`${path}.standIns[${i}]`, 'not one of this character’s reminders');
	});
	if (!to || types.length === 0) return undefined;
	return {
		to,
		types,
		...(notInPlay ? { notInPlay: true as const } : {}),
		...(onScript ? { onScript: true as const } : {}),
		...(token ? { token } : {}),
		...(whileWorks ? { whileWorks: true as const } : {}),
		...(setup ? { setup: true as const } : {}),
		...(standIns && standIns.length > 0 ? { standIns } : {})
	};
}
