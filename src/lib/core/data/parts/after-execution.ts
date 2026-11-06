import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterType,
	type ReminderLabel
} from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, type Issues } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * When a player dies by execution, the ability's `token` goes on the board by itself, while
 * the ability's player lives (or acts when dead); on its own player, only while the ability
 * works. A Traveller's exile is
 * not an execution, so it never sets it off.
 * - `of`, `alignment`: only an executed player of this character type, or this alignment
 *   (the Minstrel's Minion, the Leviathan's good player); either or both may be left out.
 * - `on`: where the token goes: its own player (left out: the Minstrel's Everyone Is Drunk), or
 *   `executed`, the executed player (the Undertaker's Died Today, the Cannibal's Lunch). Then
 *   the ability's own player may be the one executed.
 * - `moves`: with `on: executed`, a token already out moves to the new executed player (the
 *   Cannibal's Lunch); without it, a token already out stays and none is added (the
 *   Leviathan's first Good Player Executed).
 * - `marksSelf`: with `on: executed`, its own `token` also goes on its own player when the
 *   executed player has this `alignment`, and comes off when they don't (the Cannibal's
 *   Poisoned after an evil lunch).
 */
export interface AfterExecution {
	of?: CharacterType;
	alignment?: Alignment;
	token: ReminderLabel;
	on?: 'executed';
	moves?: true;
	marksSelf?: { token: ReminderLabel; alignment: Alignment };
}

/** Its token goes on the board when a player dies by execution. */
export const afterExecution = objectPart(
	'After an execution',
	'Its token goes on its player, or on the executed player, when a player dies by execution.',
	(raw, path, issues, reminders): AfterExecution | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['of', 'alignment', 'token', 'on', 'moves', 'marksSelf'], path, issues);
		const of = readEnum(raw, 'of', CHARACTER_TYPES, path, issues, false);
		const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
		const on = readEnum(raw, 'on', ['executed'] as const, path, issues, false);
		const moves = readBoolean(raw, 'moves', path, issues);
		const token = readToken(raw, 'token', path, issues, reminders);
		if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
		if (moves && !on) issues.add(`${path}.moves`, 'only with "on": "executed"');
		const marksSelf = readMarksSelf(raw.marksSelf, `${path}.marksSelf`, issues, reminders);
		if (marksSelf && !on) issues.add(`${path}.marksSelf`, 'only with "on": "executed"');
		if (token === undefined) return undefined;
		return {
			...(of ? { of } : {}),
			...(alignment ? { alignment } : {}),
			token,
			...(on ? { on } : {}),
			...(moves && on ? { moves } : {}),
			...(marksSelf && on ? { marksSelf } : {})
		};
	}
);

function readMarksSelf(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): AfterExecution['marksSelf'] {
	if (raw === undefined) return undefined;
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'alignment'], path, issues);
	const token = readToken(raw, 'token', path, issues, reminders);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, true);
	if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
	return token && alignment ? { token, alignment } : undefined;
}
