/**
 * The `jinxes` part of a character's rules block: what each jinx with another character
 * changes in the app, keyed by the other character's id (the jinxed partner). A jinx is in
 * effect for a game whose script holds both characters: that is when the Djinn joins the
 * script and its jinxes are explained to everyone, including those about characters not in
 * play (https://wiki.bloodontheclocktower.com/Djinn). The jinx's wording stays TPI's
 * (`jinxes.json`) or the script's own; this block only says what the app does about it. It
 * names a behaviour, never a character in code:
 * - `exclusive`: only one of the two may be in play, so choosing both warns at setup (the
 *   Heretic's six, https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes);
 * - `notGiven`: this character's `givesAbility` never offers the partner's ability (the
 *   Boffin's Demon cannot have the Drunk, Heretic, Ogre or Politician ability,
 *   https://wiki.bloodontheclocktower.com/Boffin#Related_Jinxes);
 * - `registersTo`: this character's player may also register as these `alignments` and
 *   `types` to the partner's ability, or with `always` registers only as them (each listed
 *   part replaces the usual ones), whatever its own ability's state: the Politician and the
 *   Zealot as evil to Legion and the Vizier, the Recluse as the Demon to the Sage and as evil
 *   to the Ogre, the Spy always as evil to the Ogre, the Summoner always as the Demon to the
 *   Clockmaker (each page's Related Jinxes);
 * - `impairsPartner`: while this character is in play (alive or dead), the partner's player
 *   is `poisoned` (or `drunk`), whatever this character's ability's state: the Spy and the
 *   Widow poison the Damsel (https://wiki.bloodontheclocktower.com/Damsel#Related_Jinxes);
 * - `noKill`: with `token`, no kill from this character tonight while the partner's own
 *   `stopsWaking` or `stopsKilling` token is on its player (the Exorcist's Chosen on the
 *   Yaggababble, the Princess's Doesn't Kill on the Al-Hadikhia); with `executed-partner`,
 *   no Demon kills tonight when this character's player nominated the partner's player today
 *   and they died by execution (the Cannibal and the Princess);
 * - `noGrimoire`: this character's player does not see the Grimoire while the partner's
 *   ability works (the Spy and the Widow while the Poppy Grower has its ability);
 * - `grimoireHides`: when this character's player sees the Grimoire while the partner is in
 *   play, these tokens come off it first: `partner`, the partner's, and every token of each
 *   listed character type (the Magician's and the Demon's, for the Spy and the Widow).
 *
 * Either character's file may hold the block. `exclusive` and `notGiven` are read from both
 * sides (`rules/jinxes.ts`); the others say what this character does, or how it is treated,
 * with the partner, so they are read from this character's side only (`ownJinxRules`). By
 * convention a block goes in the file of the character whose behaviour changes, and an
 * `exclusive` one in the first of TPI's pair.
 */
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterId,
	type CharacterType
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readStringArray,
	type Issues
} from './validate.ts';

/** A `registersTo` entry: how this character's player may register to the partner. */
export interface RegistersTo {
	alignments?: readonly Alignment[];
	types?: readonly CharacterType[];
	always?: true;
}

export const NO_KILL_TRIGGERS = ['token', 'executed-partner'] as const;
export type NoKillTrigger = (typeof NO_KILL_TRIGGERS)[number];

/** A `grimoireHides` entry: the partner's token, or every token of a character type. */
export type GrimoireHidden = 'partner' | CharacterType;
const GRIMOIRE_HIDDEN: readonly GrimoireHidden[] = ['partner', ...CHARACTER_TYPES];

export interface JinxRules {
	exclusive?: true;
	notGiven?: true;
	registersTo?: RegistersTo;
	impairsPartner?: 'poisoned' | 'drunk';
	noKill?: NoKillTrigger;
	noGrimoire?: true;
	grimoireHides?: readonly GrimoireHidden[];
}

export const JINX_RULE_KEYS = [
	'exclusive',
	'notGiven',
	'registersTo',
	'impairsPartner',
	'noKill',
	'noGrimoire',
	'grimoireHides'
] as const;

/** A non-empty list of known values, or undefined (with an issue) when it is not one. */
function readEnumList<T extends string>(
	raw: Record<string, unknown>,
	key: string,
	values: readonly T[],
	path: string,
	issues: Issues
): T[] | undefined {
	const list = readStringArray(raw, key, path, issues);
	if (!list) return undefined;
	const bad = list.filter((v) => !(values as readonly string[]).includes(v));
	for (const v of bad) issues.add(`${path}.${key}`, `unknown value ${JSON.stringify(v)}`);
	if (bad.length > 0) return undefined;
	if (list.length === 0) {
		issues.add(`${path}.${key}`, 'empty');
		return undefined;
	}
	return list as T[];
}

function readRegistersTo(raw: unknown, path: string, issues: Issues): RegistersTo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['alignments', 'types', 'always'], path, issues);
	const out: RegistersTo = {};
	const alignments = readEnumList(raw, 'alignments', ALIGNMENTS, path, issues);
	if (alignments) out.alignments = alignments;
	const types = readEnumList(raw, 'types', CHARACTER_TYPES, path, issues);
	if (types) out.types = types;
	if (readBoolean(raw, 'always', path, issues)) out.always = true;
	if (!out.alignments && !out.types) {
		issues.add(path, 'needs alignments or types');
		return undefined;
	}
	return out;
}

/** Reads a `jinxes` block: one entry per jinxed partner, each saying at least one thing. */
export function readJinxRules(
	raw: unknown,
	path: string,
	issues: Issues
): Readonly<Record<CharacterId, JinxRules>> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const out: Record<CharacterId, JinxRules> = {};
	for (const [partner, entry] of Object.entries(raw)) {
		const at = `${path}.${partner}`;
		if (!isObject(entry)) {
			issues.add(at, `expected object, got ${describe(entry)}`);
			continue;
		}
		checkKeys(entry, JINX_RULE_KEYS, at, issues);
		const rules: JinxRules = {};
		if (readBoolean(entry, 'exclusive', at, issues)) rules.exclusive = true;
		if (readBoolean(entry, 'notGiven', at, issues)) rules.notGiven = true;
		if (entry.registersTo !== undefined) {
			const registersTo = readRegistersTo(entry.registersTo, `${at}.registersTo`, issues);
			if (registersTo) rules.registersTo = registersTo;
		}
		const impairs = readEnum(
			entry,
			'impairsPartner',
			['poisoned', 'drunk'] as const,
			at,
			issues,
			false
		);
		if (impairs) rules.impairsPartner = impairs;
		const noKill = readEnum(entry, 'noKill', NO_KILL_TRIGGERS, at, issues, false);
		if (noKill) rules.noKill = noKill;
		if (readBoolean(entry, 'noGrimoire', at, issues)) rules.noGrimoire = true;
		const hides = readEnumList(entry, 'grimoireHides', GRIMOIRE_HIDDEN, at, issues);
		if (hides) rules.grimoireHides = hides;
		if (Object.keys(rules).length === 0) {
			issues.add(at, 'a jinx entry needs at least one rule');
			continue;
		}
		out[partner] = rules;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
