/**
 * The `wakesWhen` part of a character's rules block: a condition its night step needs before
 * its player wakes, on top of having an ability (`features/grimoire/night-steps.ts`):
 * - `deadAtLeastLiving`: the dead equal or outnumber the living (the King,
 *   https://wiki.bloodontheclocktower.com/King);
 * - `diedTonight`: a player who is one of `characters` died tonight, killed `by` the Demon
 *   when given (the Choirboy wakes when the Demon kills the King,
 *   https://wiki.bloodontheclocktower.com/Choirboy);
 * - `nobodyDiedToday`: nobody died since the most recent New day (the Zombuul,
 *   https://wiki.bloodontheclocktower.com/Zombuul);
 * - `untilToken`: until its own reminder is on its player (the Seamstress's No Ability once
 *   its once-per-game ability is used, https://wiki.bloodontheclocktower.com/Seamstress);
 * - `noneMarked`: while no player carries this reminder of its own (the Zombuul does not wake
 *   while anyone is marked Died Today, https://wiki.bloodontheclocktower.com/Zombuul);
 * - `markedDied`: on the first night, and on a later night only once a player carrying this
 *   reminder of its own has died (the Bounty Hunter learns a new evil player when the one
 *   marked Know dies, https://wiki.bloodontheclocktower.com/Bounty_Hunter);
 * - `nightAfterDay`: only on the night after this day, day 1 being the day after the first
 *   night (the Juggler learns on the night after the first day,
 *   https://wiki.bloodontheclocktower.com/Juggler).
 */
import type { CharacterId, ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readStringArray,
	type Issues
} from './validate.ts';
import { readToken } from './reminder-fields.ts';

export interface WakesWhen {
	deadAtLeastLiving?: true;
	diedTonight?: { characters: CharacterId[]; by?: 'demon' };
	nobodyDiedToday?: true;
	untilToken?: ReminderLabel;
	noneMarked?: ReminderLabel;
	markedDied?: ReminderLabel;
	nightAfterDay?: number;
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
	checkKeys(
		raw,
		[
			'deadAtLeastLiving',
			'diedTonight',
			'nobodyDiedToday',
			'untilToken',
			'noneMarked',
			'markedDied',
			'nightAfterDay'
		],
		path,
		issues
	);
	const out: WakesWhen = {};
	if (readBoolean(raw, 'deadAtLeastLiving', path, issues)) out.deadAtLeastLiving = true;
	if (readBoolean(raw, 'nobodyDiedToday', path, issues)) out.nobodyDiedToday = true;
	const until = readToken(raw, 'untilToken', path, issues, reminders);
	if (until) out.untilToken = until;
	const noneMarked = readToken(raw, 'noneMarked', path, issues, reminders);
	if (noneMarked) out.noneMarked = noneMarked;
	const markedDied = readToken(raw, 'markedDied', path, issues, reminders);
	if (markedDied) out.markedDied = markedDied;
	const day = readNumber(raw, 'nightAfterDay', path, issues);
	if (day !== undefined) {
		if (Number.isInteger(day) && day >= 1) out.nightAfterDay = day;
		else issues.add(`${path}.nightAfterDay`, 'expected a whole number of at least 1');
	}
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
