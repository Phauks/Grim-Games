/**
 * Types and readers for the parts of a character's rules block (`parts/`) about whom it
 * chooses, what its information is like and what the evil team's info steps must remember
 * because of it. The night order's evil
 * info notes (`rules/night-order.ts`) and the Savant's statements (`rules/savant-*.ts`) read
 * them, so neither names a character.
 */
import { SEATED_TYPES, type ReminderLabel, type SeatedType } from './types.ts';
import { readToken } from './reminder-fields.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

/** The evil info steps a note can go on. */
const EVIL_INFO_STEPS = ['minioninfo', 'demoninfo'] as const;
type EvilInfoStep = (typeof EVIL_INFO_STEPS)[number];

/**
 * How it changes the Minion and Demon info steps: a note to remember at each step while it is
 * in play (the Snitch's extra bluffs at Demon info), and `hidesDemon` when a Minion may not
 * learn the Demon because of it (the Poppy Grower, Magician, Marionette, Lil' Monsta).
 * `anyPlayerCount` gives the steps below 7 players too (the Toymaker: evil players get normal
 * starting info, https://wiki.bloodontheclocktower.com/Toymaker). `hidesMinions` while a player
 * with it lives: the Demon learns no Minions (the Poppy Grower,
 * https://wiki.bloodontheclocktower.com/Poppy_Grower); with `whileWorking`, only while its
 * ability works, so a drunk or poisoned one hides nothing (its optional rule).
 * `shownAsOtherEvil`: the Demon is shown
 * its player as a Minion and the Minions as the Demon (the Magician,
 * https://wiki.bloodontheclocktower.com/Magician). `none` leaves both steps out at any player
 * count (Tor: the Demon and Minions do not know each other,
 * https://wiki.bloodontheclocktower.com/Tor).
 */
export interface EvilInfo {
	notes?: Partial<Record<EvilInfoStep, string>>;
	hidesDemon?: true;
	anyPlayerCount?: true;
	hidesMinions?: true;
	shownAsOtherEvil?: true;
	whileWorking?: true;
	none?: true;
}

/** What its night information is like: a number (the Chef), only once per game (the Artist). */
export interface InfoKind {
	number?: true;
	oncePerGame?: true;
}

export interface SwapsForAbility {
	token: ReminderLabel;
	good: readonly SeatedType[];
	evil: readonly SeatedType[];
}

export const INFO_CARDS = ['secret-word', 'secret-phrase', 'goal'] as const;
export type InfoCard = (typeof INFO_CARDS)[number];

export function readSwaps(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): SwapsForAbility | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'good', 'evil'], path, issues);
	if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
	const token = readToken(raw, 'token', path, issues, reminders);
	const types = (key: 'good' | 'evil') => {
		const list = readStringArray(raw, key, path, issues) ?? [];
		const bad = list.filter((t) => !(SEATED_TYPES as readonly string[]).includes(t));
		if (bad.length > 0) issues.add(`${path}.${key}`, `expected types, got ${bad.join(', ')}`);
		return list.filter((t): t is SeatedType => !bad.includes(t));
	};
	const good = types('good');
	const evil = types('evil');
	return token ? { token, good, evil } : undefined;
}

/** An object of `true` flags. */
export function readFlags<K extends string>(
	raw: unknown,
	path: string,
	issues: Issues,
	keys: readonly K[]
): Partial<Record<K, true>> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, keys, path, issues);
	const out: Partial<Record<K, true>> = {};
	for (const key of keys) if (readBoolean(raw, key, path, issues)) out[key] = true;
	return out;
}

export function readEvilInfo(raw: unknown, path: string, issues: Issues): EvilInfo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const flags = [
		'hidesDemon',
		'anyPlayerCount',
		'hidesMinions',
		'shownAsOtherEvil',
		'whileWorking',
		'none'
	] as const;
	checkKeys(raw, ['notes', ...flags], path, issues);
	const out: EvilInfo = {};
	for (const flag of flags) if (readBoolean(raw, flag, path, issues)) out[flag] = true;
	if (raw.notes !== undefined) {
		const at = `${path}.notes`;
		if (!isObject(raw.notes)) issues.add(at, `expected object, got ${describe(raw.notes)}`);
		else {
			checkKeys(raw.notes, EVIL_INFO_STEPS, at, issues);
			const notes: Partial<Record<EvilInfoStep, string>> = {};
			for (const step of EVIL_INFO_STEPS) {
				const note = readString(raw.notes, step, at, issues, false);
				if (note !== undefined) notes[step] = note;
			}
			out.notes = notes;
		}
	}
	return out;
}
