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
interface EvilInfo {
	notes?: Partial<Record<EvilInfoStep, string>>;
	hidesDemon?: true;
	anyPlayerCount?: true;
	hidesMinions?: true;
	shownAsOtherEvil?: true;
	whileWorking?: true;
	none?: true;
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
	/**
	 * Its info card, filled in before it is shown: a secret word (the Mezepheles,
	 * https://wiki.bloodontheclocktower.com/Mezepheles) or phrase (the Yaggababble,
	 * https://wiki.bloodontheclocktower.com/Yaggababble). `features/info-tokens/character-cards.ts`.
	 */
	infoCard?: InfoCard;
	/**
	 * Its reminder makes whoever carries it the Demon while they do (Lil' Monsta's Is The
	 * Demon on the babysitter, https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
	 */
	carrierIsDemon?: ReminderLabel;
	/**
	 * Its player's token is swapped for a character whose ability they gain, of `good` types
	 * when good and `evil` types when evil, with `token` on them to say who they really are
	 * (the Apprentice: a Townsfolk or a Minion, https://wiki.bloodontheclocktower.com/Apprentice).
	 * The seat's ⋯ menu offers the swap (`features/grimoire/SeatCharacterFlow.svelte`).
	 */
	swapsForAbility?: SwapsForAbility;
	/**
	 * Who is woken and shown this character's token, in its own night step: every Minion (the
	 * Damsel, also at Minion info, https://wiki.bloodontheclocktower.com/Damsel), or the player
	 * carrying its `carrier` reminder (the Widow's Know,
	 * https://wiki.bloodontheclocktower.com/Widow).
	 */
	shownTo?: ShownTo;
	/**
	 * Each evil player learns who carries its `carrier` reminder: shown "This player is" with
	 * that player's character, pointing at them; with no one marked, "These characters are not
	 * in play" with the character named (the Storm Catcher's Stormcaught,
	 * https://wiki.bloodontheclocktower.com/Storm_Catcher). `named`: the key of its prep value
	 * (`setupPrep` note `value`) holding the character named, saved even when not in play.
	 */
	evilLearns?: { carrier: ReminderLabel; named?: string };
	/**
	 * Its reminder whose every copy carries the Storyteller's own words for that player, typed
	 * and shown on its `infoCard` from the reminder (the Zenomancer's Goal: the Storyteller
	 * picks each goal, https://wiki.bloodontheclocktower.com/Zenomancer).
	 */
	noteOn?: ReminderLabel;
}

export interface ShownTo {
	minions?: true;
	carrier?: ReminderLabel;
}

interface SwapsForAbility {
	token: ReminderLabel;
	good: readonly SeatedType[];
	evil: readonly SeatedType[];
}

export const INFO_CARDS = ['secret-word', 'secret-phrase', 'goal'] as const;
export type InfoCard = (typeof INFO_CARDS)[number];

export const CHOICE_RULE_KEYS = [
	'marksChoice',
	'curses',
	'choosesLikeDemon',
	'choosesUnmarked',
	'believesOtherCharacter',
	'believesType',
	'infoKind',
	'evilInfo',
	'infoCard',
	'carrierIsDemon',
	'swapsForAbility',
	'shownTo',
	'evilLearns',
	'noteOn'
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
	const card = readString(raw, 'infoCard', path, issues, false);
	if (card !== undefined && !(INFO_CARDS as readonly string[]).includes(card)) {
		issues.add(`${path}.infoCard`, `expected one of ${INFO_CARDS.join(', ')}`);
	} else if (card !== undefined) out.infoCard = card as InfoCard;
	const noteOn = readToken(raw, 'noteOn', path, issues, reminders);
	if (noteOn) out.noteOn = noteOn;
	const demon = readToken(raw, 'carrierIsDemon', path, issues, reminders);
	if (demon) out.carrierIsDemon = demon;
	if (raw.swapsForAbility !== undefined) {
		const swaps = readSwaps(raw.swapsForAbility, `${path}.swapsForAbility`, issues, reminders);
		if (swaps) out.swapsForAbility = swaps;
	}
	if (raw.shownTo !== undefined) {
		const at = `${path}.shownTo`;
		if (!isObject(raw.shownTo)) issues.add(at, `expected object, got ${describe(raw.shownTo)}`);
		else {
			checkKeys(raw.shownTo, ['minions', 'carrier'], at, issues);
			const minions = readBoolean(raw.shownTo, 'minions', at, issues);
			const carrier = readToken(raw.shownTo, 'carrier', at, issues, reminders);
			if (!minions && !carrier) issues.add(at, 'expected minions or carrier');
			else
				out.shownTo = {
					...(minions ? { minions: true as const } : {}),
					...(carrier ? { carrier } : {})
				};
		}
	}
	if (raw.evilLearns !== undefined) {
		const at = `${path}.evilLearns`;
		if (!isObject(raw.evilLearns))
			issues.add(at, `expected object, got ${describe(raw.evilLearns)}`);
		else {
			checkKeys(raw.evilLearns, ['carrier', 'named'], at, issues);
			if (raw.evilLearns.carrier === undefined) issues.add(`${at}.carrier`, 'missing');
			const carrier = readToken(raw.evilLearns, 'carrier', at, issues, reminders);
			const named = readString(raw.evilLearns, 'named', at, issues, false);
			if (carrier) out.evilLearns = { carrier, ...(named ? { named } : {}) };
		}
	}
	return out;
}

function readSwaps(
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
