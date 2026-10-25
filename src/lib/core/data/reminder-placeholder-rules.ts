/**
 * What each `:reminder:` in a character's night text means (Trevor, 2026-10-15: ":reminder:
 * ... defers to the first reminder token, which is not always proper. see pukka"): the
 * `reminderPlaceholders` part of its rules block, read here and used by `rules/night-text.ts`
 * and the night walk-through.
 *
 * TPI's text marks where a reminder token is handled with a bare `:reminder:`; it never says
 * which token, or whether it goes on or comes off. `first` and `other` say so for every
 * occurrence in that night's text, one entry per `:reminder:` in text order:
 * - `tokens`: the reminder tokens (the character's own reminder names);
 * - each token's `action`: `place` puts it on a player, `remove` takes it off;
 * - `either`: only one of the tokens applies, depending on what happens (the Barista's two
 *   effects, the Po's single kill or charge).
 *
 * `note` says what the mapping encodes, in our own words. Each mapping was decided from the
 * character's wiki page (the rules authority).
 */
import type { ReminderLabel } from './types.ts';
import { checkKeys, describe, isObject, readEnum, readString, type Issues } from './validate.ts';

export const PLACEHOLDER_ACTIONS = ['place', 'remove'] as const;
export type PlaceholderAction = (typeof PLACEHOLDER_ACTIONS)[number];

export interface PlaceholderToken {
	label: ReminderLabel;
	action: PlaceholderAction;
}

export interface ReminderPlaceholder {
	tokens: readonly PlaceholderToken[];
	either?: boolean;
}

export const PLACEHOLDER_NIGHTS = ['first', 'other'] as const;

export interface ReminderPlaceholderRules {
	first?: readonly ReminderPlaceholder[];
	other?: readonly ReminderPlaceholder[];
	note?: string;
}

function readPlaceholder(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ReminderPlaceholder | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['tokens', 'either'], path, issues);
	if (raw.either !== undefined && raw.either !== true)
		issues.add(`${path}.either`, 'expected true');
	if (!Array.isArray(raw.tokens) || raw.tokens.length === 0) {
		issues.add(`${path}.tokens`, 'expected a list of tokens');
		return undefined;
	}
	const tokens = raw.tokens.map((t, i): PlaceholderToken | undefined => {
		const at = `${path}.tokens[${i}]`;
		if (!isObject(t)) {
			issues.add(at, `expected object, got ${describe(t)}`);
			return undefined;
		}
		checkKeys(t, ['label', 'action'], at, issues);
		const label = readString(t, 'label', at, issues, true);
		const action = readEnum(t, 'action', PLACEHOLDER_ACTIONS, at, issues, true);
		if (label !== undefined && reminders && !reminders.includes(label)) {
			issues.add(`${at}.label`, 'not one of this character’s reminders');
		}
		return label === undefined || !action ? undefined : { label, action };
	});
	if (!tokens.every((t) => t !== undefined)) return undefined;
	return { tokens, ...(raw.either === true ? { either: true } : {}) };
}

/** Reads a `reminderPlaceholders` block; `reminders` are the character's own labels, when given. */
export function readReminderPlaceholders(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ReminderPlaceholderRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, [...PLACEHOLDER_NIGHTS, 'note'], path, issues);
	const out: { first?: ReminderPlaceholder[]; other?: ReminderPlaceholder[]; note?: string } = {};
	for (const night of PLACEHOLDER_NIGHTS) {
		const list = raw[night];
		if (list === undefined) continue;
		if (!Array.isArray(list)) {
			issues.add(`${path}.${night}`, `expected array, got ${describe(list)}`);
			continue;
		}
		out[night] = list.flatMap(
			(p, i) => readPlaceholder(p, `${path}.${night}[${i}]`, issues, reminders) ?? []
		);
	}
	const note = readString(raw, 'note', path, issues, false);
	if (note !== undefined) out.note = note;
	return out;
}
