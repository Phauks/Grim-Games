/**
 * What the Storyteller should watch for during the day because of a character: the
 * `dayReminders` part of its rules block, read here and shown by `rules/day-reminders.ts`.
 *
 * - `reminders`: short, state-based sentences built from segments:
 *   - `{ self: true }`: this character, shown as a badge ("[Witch · Sam]");
 *   - `{ target: true }`: the character of the player carrying the reminder token named in
 *     `when.reminder` ("[Librarian · Alex]");
 *   - `{ text }`: our own words, kept short;
 *   - `{ value, placeholder }`: a value the Storyteller entered during prep (`SetupNote.value`,
 *     stored on the game as `prepValues`), shown as `placeholder` until entered.
 * - `impairable: true`: while that player's ability does not work (drunk, poisoned, or no
 *   ability: `abilityState`), one line "[Slayer] is poisoned by [Poisoner]" replaces the
 *   character's lines about its living ability, so the two never show together.
 * - `interactions`: ways this character may register falsely and so set off or block another
 *   character's day ability (Trevor, 2026-10-16: "if the Spy is alive, it can register as
 *   good, which means it can trigger the Virgin"). Each shows while both are in play and
 *   alive, this character's ability works, and the other's is unused (`otherNoReminder`),
 *   read "[this] {text} [other]".
 * - `none`: why a character has nothing to watch by day (its ability acts at night or at
 *   setup), so the app knows it has been checked and does not guess from its ability text.
 *
 * `when` says when a reminder shows:
 * - `self: 'alive' | 'dead' | 'any'` (default 'alive');
 * - `reminder`: only while this character's reminder token is on a player; one reminder per
 *   player carrying it;
 * - `noReminder`: only while that token is NOT on any player ("No Ability": unused);
 * - `cause`: with `self: 'dead'`, only if the death's cause is one of these ('demon' also
 *   matches any Demon's id). An unknown cause counts as a match, flagged `uncertain`.
 *   The app does not track day or night, so nothing here depends on the day number.
 * - `minAlive`: only while at least this many players are alive;
 * - `targetAlive`: with `reminder`, only while the player carrying the token is alive.
 *
 * Text here is our own summary, never wiki prose.
 */
import type { CharacterId, ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	type Issues
} from './validate.ts';

export const DAY_GROUPS = [
	'day-ability',
	'nomination',
	'vote',
	'execution-death',
	'madness',
	'announcement'
] as const;
export type DayGroup = (typeof DAY_GROUPS)[number];

export const DAY_GROUP_TITLES: Record<DayGroup, string> = {
	'day-ability': 'Day abilities',
	nomination: 'Nominations',
	vote: 'Voting',
	'execution-death': 'Executions and deaths',
	madness: 'Madness',
	announcement: 'Public knowledge'
};

export type TemplateSegment =
	{ self: true } | { target: true } | { text: string } | { value: string; placeholder: string };

/** How a death is matched: a cause the app records, or a character id. */
export type DeathCauseMatch = 'execution' | 'exile' | 'demon' | 'other' | CharacterId;

const SELF_STATES = ['alive', 'dead', 'any'] as const;

export interface DayCondition {
	self?: (typeof SELF_STATES)[number];
	reminder?: ReminderLabel;
	noReminder?: ReminderLabel;
	cause?: readonly DeathCauseMatch[];
	minAlive?: number;
	/** With `reminder`: only while the player carrying it is alive. */
	targetAlive?: boolean;
}

export interface DayReminderSpec {
	group: DayGroup;
	template: readonly TemplateSegment[];
	when?: DayCondition;
}

export interface DayInteraction {
	/** The character whose ability this one's registration can set off or block. */
	other: CharacterId;
	group: DayGroup;
	text: string;
	/** Only while this reminder of `other` is on no player ("No Ability": unused). */
	otherNoReminder?: ReminderLabel;
}

export interface DayReminderRules {
	impairable?: true;
	reminders?: readonly DayReminderSpec[];
	interactions?: readonly DayInteraction[];
	none?: string;
}

const ownReminder = (token: string, reminders: readonly ReminderLabel[] | undefined) =>
	!reminders || reminders.some((r) => r.toLowerCase() === token.toLowerCase());

function readSegment(raw: unknown, path: string, issues: Issues): TemplateSegment | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	if (raw.self !== undefined || raw.target !== undefined) {
		const key = raw.self !== undefined ? 'self' : 'target';
		checkKeys(raw, [key], path, issues);
		if (raw[key] !== true) issues.add(`${path}.${key}`, 'expected true');
		return raw[key] !== true ? undefined : key === 'self' ? { self: true } : { target: true };
	}
	if (raw.value !== undefined) {
		checkKeys(raw, ['value', 'placeholder'], path, issues);
		const value = readString(raw, 'value', path, issues, true);
		const placeholder = readString(raw, 'placeholder', path, issues, true);
		return value === undefined || placeholder === undefined ? undefined : { value, placeholder };
	}
	checkKeys(raw, ['text'], path, issues);
	const text = readString(raw, 'text', path, issues, true);
	return text === undefined ? undefined : { text };
}

function readCondition(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): DayCondition | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		['self', 'reminder', 'noReminder', 'cause', 'minAlive', 'targetAlive'],
		path,
		issues
	);
	const out: { -readonly [K in keyof DayCondition]: DayCondition[K] } = {};
	const self = readEnum(raw, 'self', SELF_STATES, path, issues, false);
	if (self) out.self = self;
	for (const key of ['reminder', 'noReminder'] as const) {
		const token = readString(raw, key, path, issues, false);
		if (token === undefined) continue;
		if (!ownReminder(token, reminders)) {
			issues.add(`${path}.${key}`, 'not one of this character’s reminders');
		}
		out[key] = token;
	}
	if (raw.cause !== undefined) {
		const cause = raw.cause;
		if (!Array.isArray(cause) || !cause.every((c) => typeof c === 'string' && c !== '')) {
			issues.add(`${path}.cause`, 'expected a list of death causes or character ids');
		} else out.cause = cause as string[];
	}
	const minAlive = readNumber(raw, 'minAlive', path, issues);
	if (minAlive !== undefined) out.minAlive = minAlive;
	const targetAlive = readBoolean(raw, 'targetAlive', path, issues);
	if (targetAlive !== undefined) out.targetAlive = targetAlive;
	return out;
}

function readSpec(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): DayReminderSpec | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['group', 'template', 'when'], path, issues);
	const group = readEnum(raw, 'group', DAY_GROUPS, path, issues, true);
	let template: TemplateSegment[] | undefined;
	if (!Array.isArray(raw.template) || raw.template.length === 0) {
		issues.add(`${path}.template`, 'expected a list of segments');
	} else {
		const parts = raw.template.map((s, i) => readSegment(s, `${path}.template[${i}]`, issues));
		if (parts.every((p) => p !== undefined)) template = parts;
	}
	const when =
		raw.when === undefined ? undefined : readCondition(raw.when, `${path}.when`, issues, reminders);
	if (template?.some((p) => 'target' in p) && !when?.reminder) {
		issues.add(`${path}.when.reminder`, 'a target segment needs the reminder that marks them');
	}
	if (!group || !template) return undefined;
	return { group, template, ...(when ? { when } : {}) };
}

function readInteraction(raw: unknown, path: string, issues: Issues): DayInteraction | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['other', 'group', 'text', 'otherNoReminder'], path, issues);
	const other = readString(raw, 'other', path, issues, true);
	const group = readEnum(raw, 'group', DAY_GROUPS, path, issues, true);
	const text = readString(raw, 'text', path, issues, true);
	const otherNoReminder = readString(raw, 'otherNoReminder', path, issues, false);
	if (other === undefined || !group || text === undefined) return undefined;
	return { other, group, text, ...(otherNoReminder ? { otherNoReminder } : {}) };
}

/** Reads a `dayReminders` block; `reminders` are the character's own labels, when given. */
export function readDayReminders(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): DayReminderRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['impairable', 'reminders', 'interactions', 'none'], path, issues);
	const out: {
		impairable?: true;
		reminders?: DayReminderSpec[];
		interactions?: DayInteraction[];
		none?: string;
	} = {};
	if (raw.impairable !== undefined) {
		if (raw.impairable !== true) issues.add(`${path}.impairable`, 'expected true');
		else out.impairable = true;
	}
	for (const key of ['reminders', 'interactions'] as const) {
		const list = raw[key];
		if (list === undefined) continue;
		if (!Array.isArray(list)) {
			issues.add(`${path}.${key}`, `expected array, got ${describe(list)}`);
			continue;
		}
		if (key === 'reminders') {
			out.reminders = list.flatMap(
				(r, i) => readSpec(r, `${path}.reminders[${i}]`, issues, reminders) ?? []
			);
		} else {
			out.interactions = list.flatMap(
				(r, i) => readInteraction(r, `${path}.interactions[${i}]`, issues) ?? []
			);
		}
	}
	const none = readString(raw, 'none', path, issues, false);
	if (none !== undefined) out.none = none;
	if (none !== undefined && out.reminders?.length) {
		issues.add(`${path}.none`, 'a character with day reminders has something to watch');
	}
	return out;
}
