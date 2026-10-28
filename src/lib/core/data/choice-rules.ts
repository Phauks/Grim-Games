/**
 * The parts of a character's rules block about whom it chooses, what its information is like
 * and what the evil team's info steps must remember because of it. The night order's evil
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
	readEnum,
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
 */
interface EvilInfo {
	notes?: Partial<Record<EvilInfoStep, string>>;
	hidesDemon?: true;
}

/** What its night information is like: a number (the Chef), only once per game (the Artist). */
interface InfoKind {
	number?: true;
	oncePerGame?: true;
}

/** The rules this file reads; part of `CharacterRules`. */
export interface ChoiceRules {
	/** Its reminders that mark whom it chose last night (the Monk's Safe, the Poisoner's Poisoned). */
	marksChoice?: readonly ReminderLabel[];
	/** Its reminder that marks the player it cursed (the Witch's Cursed). */
	curses?: ReminderLabel;
	/** Its reminder that marks whom its player chose as if they were the Demon (the Lunatic). */
	choosesLikeDemon?: ReminderLabel;
	/** It chooses a player each night and no reminder records whom (the Snake Charmer). */
	choosesUnmarked?: boolean;
	/** Its player is told they are another character (the Lunatic thinks they are the Demon). */
	believesOtherCharacter?: boolean;
	/**
	 * The type of character its player is shown instead of its own (the Lunatic thinks they are
	 * the Demon, https://wiki.bloodontheclocktower.com/Lunatic): its bag tile asks which, and a
	 * second bluff set is theirs.
	 */
	believesType?: SeatedType;
	infoKind?: InfoKind;
	evilInfo?: EvilInfo;
}

export const CHOICE_RULE_KEYS = [
	'marksChoice',
	'curses',
	'choosesLikeDemon',
	'choosesUnmarked',
	'believesOtherCharacter',
	'believesType',
	'infoKind',
	'evilInfo'
] as const satisfies readonly (keyof ChoiceRules)[];

/** Reads this file's keys from a rules block; labels must be the character's own reminders. */
export function readChoiceRules(
	raw: Record<string, unknown>,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ChoiceRules {
	const out: ChoiceRules = {};
	const marks = readStringArray(raw, 'marksChoice', path, issues);
	if (marks) {
		const own = marks.filter((label, i) => {
			const ok = readToken({ label }, 'label', `${path}.marksChoice[${i}]`, issues, reminders);
			return ok !== undefined;
		});
		if (own.length === marks.length) out.marksChoice = own;
	}
	const curses = readToken(raw, 'curses', path, issues, reminders);
	if (curses) out.curses = curses;
	const chooses = readToken(raw, 'choosesLikeDemon', path, issues, reminders);
	if (chooses) out.choosesLikeDemon = chooses;
	const unmarked = readBoolean(raw, 'choosesUnmarked', path, issues);
	if (unmarked !== undefined) out.choosesUnmarked = unmarked;
	const believes = readBoolean(raw, 'believesOtherCharacter', path, issues);
	if (believes !== undefined) out.believesOtherCharacter = believes;
	const believesType = readEnum(raw, 'believesType', SEATED_TYPES, path, issues, false);
	if (believesType) out.believesType = believesType;
	if (raw.infoKind !== undefined) {
		const infoKind = readFlags(raw.infoKind, `${path}.infoKind`, issues, ['number', 'oncePerGame']);
		if (infoKind) out.infoKind = infoKind;
	}
	if (raw.evilInfo !== undefined) {
		const evilInfo = readEvilInfo(raw.evilInfo, `${path}.evilInfo`, issues);
		if (evilInfo) out.evilInfo = evilInfo;
	}
	return out;
}

/** An object of `true` flags. */
function readFlags<K extends string>(
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

function readEvilInfo(raw: unknown, path: string, issues: Issues): EvilInfo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['notes', 'hidesDemon'], path, issues);
	const out: EvilInfo = {};
	if (readBoolean(raw, 'hidesDemon', path, issues)) out.hidesDemon = true;
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
