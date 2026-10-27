/**
 * What the Storyteller prepares for a character between the draw and the first night: the
 * `setupPrep` part of its rules block, read here and suggested by `rules/setup-reminders.ts`.
 *
 * - `reminders`: tokens the Storyteller places before the first night (or at the start of the
 *   first day). Only tokens the Storyteller decides are listed: a token marking what a player
 *   chooses at night is placed when they choose.
 * - `notes`: other preparation that is not a token placement (words to choose, bluffs to set
 *   aside), with any token the step may use.
 * - `none`: why a character with reminder tokens places none at setup, so the app knows it
 *   has been checked (a custom character with tokens and no `setupPrep` is flagged).
 *
 * `reason` and `none` are our own summaries, never wiki prose.
 */
import type { ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readEnum,
	readBoolean,
	readNumber,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

export const SETUP_TIMINGS = ['setup', 'first-day'] as const;
export type SetupTiming = (typeof SETUP_TIMINGS)[number];

/**
 * Who may get the token, read from the grimoire:
 * - `any`: any player;
 * - `good` / `evil`: by the seat's alignment;
 * - `townsfolk` / `outsider` / `minion`: by the true character's type;
 * - `not-demon`: any player whose true character isn't a Demon;
 * - `same-alignment`: a player of this character's alignment;
 * - `copies`: one of the players who have this character (Village Idiots);
 * - `nearest-townsfolk-anticlockwise` / `-clockwise`: the nearest Townsfolk that way round
 *   from this character, alive or dead (No Dashii, `nearestOfType`).
 */
export const SEAT_FILTERS = [
	'any',
	'good',
	'evil',
	'townsfolk',
	'outsider',
	'minion',
	'not-demon',
	'same-alignment',
	'copies',
	'nearest-townsfolk-anticlockwise',
	'nearest-townsfolk-clockwise'
] as const;
export type SeatFilter = (typeof SEAT_FILTERS)[number];

/**
 * - `{ self: true }`: on this character's own seat (the Drunk's "Is The Drunk");
 * - `{ choose, choice }`: on a player the Storyteller picks. `choose` filters the candidates;
 *   when exactly one player fits, the app pre-fills them. `choice` is the short hint shown
 *   when it can't. `notSelf` leaves out this character's own seat. A player already
 *   pre-filled for an earlier token of the same character is left out too.
 */
export type SetupTarget =
	{ self: true } | { choose: SeatFilter; choice: string; notSelf?: boolean };

/** At least or exactly so many Outsiders in play, or at least so many copies of it. */
export interface SetupCondition {
	minOutsiders?: number;
	exactOutsiders?: number;
	minCopies?: number;
}

export interface SetupReminderSpec {
	label: ReminderLabel;
	/**
	 * What the Storyteller does, as one short line with the token in [brackets]. Tokens of
	 * one character with the same text are one step (the Knight's 2 KNOW tokens).
	 */
	text: string;
	target: SetupTarget;
	reason: string;
	/** 'setup' (default) before the first night, 'first-day' at the start of the first day. */
	timing?: SetupTiming;
	when?: SetupCondition;
	/** Listed before every other setup reminder, as too important to miss (the Drunk's). */
	first?: true;
}

export interface SetupNote {
	text: string;
	tokens?: readonly ReminderLabel[];
	/**
	 * A value the Storyteller types in during prep and the app shows later (the
	 * Yaggababble's phrase in its pre-day reminder): stored as `Game.prepValues`.
	 */
	value?: { key: string; label: string };
}

export interface SetupPrepRules {
	reminders?: readonly SetupReminderSpec[];
	notes?: readonly SetupNote[];
	none?: string;
}

const ownReminder = (token: string, reminders: readonly ReminderLabel[] | undefined) =>
	!reminders || reminders.some((r) => r.toLowerCase() === token.toLowerCase());

function readTarget(raw: unknown, path: string, issues: Issues): SetupTarget | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	if (raw.self !== undefined) {
		checkKeys(raw, ['self'], path, issues);
		if (raw.self !== true) issues.add(`${path}.self`, 'expected true');
		return raw.self === true ? { self: true } : undefined;
	}
	checkKeys(raw, ['choose', 'choice', 'notSelf'], path, issues);
	const choose = readEnum(raw, 'choose', SEAT_FILTERS, path, issues, true);
	const choice = readString(raw, 'choice', path, issues, true);
	if (raw.notSelf !== undefined && raw.notSelf !== true) {
		issues.add(`${path}.notSelf`, 'expected true');
	}
	if (!choose || choice === undefined) return undefined;
	return { choose, choice, ...(raw.notSelf === true ? { notSelf: true } : {}) };
}

function readCondition(raw: unknown, path: string, issues: Issues): SetupCondition | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const keys = ['minOutsiders', 'exactOutsiders', 'minCopies'] as const;
	checkKeys(raw, keys, path, issues);
	const out: SetupCondition = {};
	for (const key of keys) {
		const n = readNumber(raw, key, path, issues);
		if (n !== undefined) out[key] = n;
	}
	return out;
}

function readReminder(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): SetupReminderSpec | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['label', 'text', 'target', 'reason', 'timing', 'when', 'first'], path, issues);
	const label = readString(raw, 'label', path, issues, true);
	if (label !== undefined && !ownReminder(label, reminders)) {
		issues.add(`${path}.label`, 'not one of this character’s reminders');
	}
	const text = readString(raw, 'text', path, issues, true);
	const reason = readString(raw, 'reason', path, issues, true);
	const target =
		raw.target === undefined
			? (issues.add(`${path}.target`, 'missing'), undefined)
			: readTarget(raw.target, `${path}.target`, issues);
	const timing = readEnum(raw, 'timing', SETUP_TIMINGS, path, issues, false);
	const when = raw.when === undefined ? undefined : readCondition(raw.when, `${path}.when`, issues);
	const first = readBoolean(raw, 'first', path, issues);
	if (first === false) issues.add(`${path}.first`, 'expected true, or leave it out');
	if (label === undefined || text === undefined || reason === undefined || !target) {
		return undefined;
	}
	return {
		label,
		text,
		target,
		reason,
		...(timing ? { timing } : {}),
		...(when ? { when } : {}),
		...(first ? { first: true as const } : {})
	};
}

function readNote(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): SetupNote | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['text', 'tokens', 'value'], path, issues);
	const text = readString(raw, 'text', path, issues, true);
	const tokens = readStringArray(raw, 'tokens', path, issues);
	tokens?.forEach((t, i) => {
		if (!ownReminder(t, reminders)) {
			issues.add(`${path}.tokens[${i}]`, 'not one of this character’s reminders');
		}
	});
	let value: SetupNote['value'];
	if (raw.value !== undefined) {
		const at = `${path}.value`;
		if (!isObject(raw.value)) issues.add(at, `expected object, got ${describe(raw.value)}`);
		else {
			checkKeys(raw.value, ['key', 'label'], at, issues);
			const key = readString(raw.value, 'key', at, issues, true);
			const label = readString(raw.value, 'label', at, issues, true);
			if (key !== undefined && label !== undefined) value = { key, label };
		}
	}
	if (text === undefined) return undefined;
	return { text, ...(tokens ? { tokens } : {}), ...(value ? { value } : {}) };
}

/** Reads a `setupPrep` block; `reminders` are the character's own labels, when given. */
export function readSetupPrep(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): SetupPrepRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['reminders', 'notes', 'none'], path, issues);
	const out: { reminders?: SetupReminderSpec[]; notes?: SetupNote[]; none?: string } = {};
	for (const key of ['reminders', 'notes'] as const) {
		const list = raw[key];
		if (list === undefined) continue;
		if (!Array.isArray(list)) {
			issues.add(`${path}.${key}`, `expected array, got ${describe(list)}`);
			continue;
		}
		if (key === 'reminders') {
			out.reminders = list.flatMap(
				(r, i) => readReminder(r, `${path}.reminders[${i}]`, issues, reminders) ?? []
			);
		} else {
			out.notes = list.flatMap(
				(n, i) => readNote(n, `${path}.notes[${i}]`, issues, reminders) ?? []
			);
		}
	}
	const none = readString(raw, 'none', path, issues, false);
	if (none !== undefined) out.none = none;
	return out;
}
