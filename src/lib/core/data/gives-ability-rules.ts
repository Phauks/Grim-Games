/**
 * The `givesAbility` part of a character's rules block: it gives another player an ability
 * they hold without its token (`Seat.abilities`, `rules/gained-abilities.ts`). The
 * Storyteller picks the ability from the seat's ⋯ menu. It names a behaviour, never a
 * character:
 * - `to`: who holds it; `demon`, the Demon in play (the Boffin,
 *   https://wiki.bloodontheclocktower.com/Boffin), or `storyteller`, the Storyteller, who
 *   makes its choices (the Plague Doctor, picked on its night step once it dies,
 *   https://wiki.bloodontheclocktower.com/Plague_Doctor);
 * - `types`: the character types the ability may come from;
 * - `notInPlay`: only a character not in play;
 * - `token`: its reminder that marks the held ability on the board (the Plague Doctor's
 *   Storyteller Ability);
 * - `whileWorks`: the holder has it only while this character's ability works, so not while
 *   its player is dead, drunk or poisoned (the Boffin's Summary on the wiki).
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

export const GIVES_ABILITY_TO = ['demon', 'storyteller'] as const;
export type GivesAbilityTo = (typeof GIVES_ABILITY_TO)[number];

export interface GivesAbility {
	to: GivesAbilityTo;
	types: readonly SeatedType[];
	notInPlay?: true;
	token?: ReminderLabel;
	whileWorks?: true;
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
	checkKeys(raw, ['to', 'types', 'notInPlay', 'token', 'whileWorks'], path, issues);
	const to = readEnum(raw, 'to', GIVES_ABILITY_TO, path, issues, true);
	const types = (readStringArray(raw, 'types', path, issues) ?? []).filter((t, i) => {
		const ok = (SEATED_TYPES as readonly string[]).includes(t);
		if (!ok) issues.add(`${path}.types[${i}]`, `unknown value ${JSON.stringify(t)}`);
		return ok;
	}) as SeatedType[];
	if (types.length === 0) issues.add(`${path}.types`, 'expected at least one character type');
	const notInPlay = readBoolean(raw, 'notInPlay', path, issues);
	const whileWorks = readBoolean(raw, 'whileWorks', path, issues);
	const token = readToken(raw, 'token', path, issues, reminders);
	if (!to || types.length === 0) return undefined;
	return {
		to,
		types,
		...(notInPlay ? { notInPlay: true as const } : {}),
		...(token ? { token } : {}),
		...(whileWorks ? { whileWorks: true as const } : {})
	};
}
