/**
 * The `wakesWhen` part of a character's rules block: a condition its night step needs before
 * its player wakes, on top of having an ability (`features/grimoire/night-steps.ts`):
 * - `deadAtLeastLiving`: the dead equal or outnumber the living (the King,
 *   https://wiki.bloodontheclocktower.com/King);
 * - `diedTonight`: a player who is one of `characters` died tonight, killed `by` the Demon
 *   when given (the Choirboy wakes when the Demon kills the King,
 *   https://wiki.bloodontheclocktower.com/Choirboy);
 * - `untilToken`: until its own reminder is on its player (the Seamstress's No Ability once
 *   its once-per-game ability is used, https://wiki.bloodontheclocktower.com/Seamstress).
 */
import type { CharacterId, ReminderLabel } from './types.ts';
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

export interface WakesWhen {
	deadAtLeastLiving?: true;
	diedTonight?: { characters: CharacterId[]; by?: 'demon' };
	untilToken?: ReminderLabel;
}

/** Reads a `wakesWhen` block; `untilToken` must be one of the character's `reminders`. */
export function readWakesWhen(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): WakesWhen | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['deadAtLeastLiving', 'diedTonight', 'untilToken'], path, issues);
	const out: WakesWhen = {};
	if (readBoolean(raw, 'deadAtLeastLiving', path, issues)) out.deadAtLeastLiving = true;
	const until = readToken(raw, 'untilToken', path, issues, reminders);
	if (until) out.untilToken = until;
	if (raw.diedTonight !== undefined) {
		const at = `${path}.diedTonight`;
		if (!isObject(raw.diedTonight)) {
			issues.add(at, `expected object, got ${describe(raw.diedTonight)}`);
		} else {
			checkKeys(raw.diedTonight, ['characters', 'by'], at, issues);
			const characters = readStringArray(raw.diedTonight, 'characters', at, issues);
			const by = readEnum(raw.diedTonight, 'by', ['demon'] as const, at, issues, false);
			if (!characters?.length) issues.add(`${at}.characters`, 'missing');
			else out.diedTonight = { characters, ...(by ? { by } : {}) };
		}
	}
	if (Object.keys(out).length === 0) issues.add(path, 'no condition');
	return out;
}
