/**
 * The `wakesWhen` part of a character's rules block: a condition its night step needs before
 * its player wakes, on top of having an ability (`features/grimoire/night-steps.ts`):
 * - `deadAtLeastLiving`: the dead equal or outnumber the living (the King,
 *   https://wiki.bloodontheclocktower.com/King);
 * - `deadAtLeast`: at least this many players are dead; with `deadAtLeastLiving` too, either
 *   is enough (with the Leviathan or Riot in play, one dead player wakes the King, M61d);
 * - `diedTonight`: a player who is one of `characters` died tonight, killed `by` the Demon
 *   when given (the Choirboy wakes when the Demon kills the King,
 *   https://wiki.bloodontheclocktower.com/Choirboy);
 * - `diedToday`: on the first night, and on a later night only when a player whose character
 *   type is one of `types` died since the most recent New day, or a player carries the
 *   character's own `token` (the Godfather wakes the night after an Outsider died today,
 *   https://wiki.bloodontheclocktower.com/Godfather);
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
 *   https://wiki.bloodontheclocktower.com/Juggler);
 * - `becameToday`: only when its player became this character since the most recent New day,
 *   so never on the first night (the Damsel's step shows the Minions a Damsel made mid-game;
 *   on the first night Minion info shows them, https://wiki.bloodontheclocktower.com/Damsel).
 */
import {
	CHARACTER_TYPES,
	type CharacterId,
	type CharacterType,
	type ReminderLabel
} from './types.ts';
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
	deadAtLeast?: number;
	diedTonight?: { characters: CharacterId[]; by?: 'demon' };
	diedToday?: { types: CharacterType[]; token?: ReminderLabel };
	nobodyDiedToday?: true;
	untilToken?: ReminderLabel;
	noneMarked?: ReminderLabel;
	markedDied?: ReminderLabel;
	nightAfterDay?: number;
	becameToday?: true;
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
			'deadAtLeast',
			'diedTonight',
			'diedToday',
			'nobodyDiedToday',
			'untilToken',
			'noneMarked',
			'markedDied',
			'nightAfterDay',
			'becameToday'
		],
		path,
		issues
	);
	const out: WakesWhen = {};
	if (readBoolean(raw, 'deadAtLeastLiving', path, issues)) out.deadAtLeastLiving = true;
	if (readBoolean(raw, 'nobodyDiedToday', path, issues)) out.nobodyDiedToday = true;
	if (readBoolean(raw, 'becameToday', path, issues)) out.becameToday = true;
	const until = readToken(raw, 'untilToken', path, issues, reminders);
	if (until) out.untilToken = until;
	const noneMarked = readToken(raw, 'noneMarked', path, issues, reminders);
	if (noneMarked) out.noneMarked = noneMarked;
	const markedDied = readToken(raw, 'markedDied', path, issues, reminders);
	if (markedDied) out.markedDied = markedDied;
	const atLeast = readNumber(raw, 'deadAtLeast', path, issues);
	if (atLeast !== undefined) {
		if (Number.isInteger(atLeast) && atLeast >= 1) out.deadAtLeast = atLeast;
		else issues.add(`${path}.deadAtLeast`, 'expected a whole number of at least 1');
	}
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
	if (raw.diedToday !== undefined) {
		const at = `${path}.diedToday`;
		if (!isObject(raw.diedToday)) {
			issues.add(at, `expected object, got ${describe(raw.diedToday)}`);
		} else {
			checkKeys(raw.diedToday, ['types', 'token'], at, issues);
			const types = readStringArray(raw.diedToday, 'types', at, issues);
			const bad = types?.filter((t) => !(CHARACTER_TYPES as readonly string[]).includes(t));
			if (bad?.length) issues.add(`${at}.types`, `unknown type ${bad.join(', ')}`);
			const token = readToken(raw.diedToday, 'token', at, issues, reminders);
			if (!types?.length) issues.add(`${at}.types`, 'missing');
			else if (!bad?.length)
				out.diedToday = { types: types as CharacterType[], ...(token ? { token } : {}) };
		}
	}
	if (Object.keys(out).length === 0) issues.add(path, 'no condition');
	return out;
}
