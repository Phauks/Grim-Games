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
 *   https://wiki.bloodontheclocktower.com/Boffin#Related_Jinxes).
 * - `givenInstead`: when this character's `givesAbility` would give the partner's ability to
 *   the Storyteller, something else happens instead (the Plague Doctor's Minions,
 *   https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes): `a-minion`, a Minion
 *   holds it and learns this; `a-player-becomes`, a player becomes the partner;
 *   `demon-neighbour-becomes`, one of the Demon's good neighbours becomes it; `outsiders`, up
 *   to two players become Outsiders;
 * - `noTurnGood`: a player this character gives the partner's ability to (`givesAbility`), or
 *   turns from evil into the partner (`changesCharacter`), can't turn good by that ability, so
 *   the app offers no change to good and warns on one made by hand (the Boffin's Cult Leader
 *   and Goon, the Pit-Hag's Cult Leader, Goon, Ogre and Politician);
 * - `spareToken`: with a spare token, this character may give or create the partner even
 *   while it is in play, so its picker offers it (the Boffin's and the Pit-Hag's Village
 *   Idiot);
 * - `storytellerPicksPlayer`: when this character creates the partner, the Storyteller picks
 *   which player it is, and its step says so (the Pit-Hag's Damsel).
 *
 * Either character's file may hold the block; the app reads both sides (`rules/jinxes.ts`).
 * By convention it goes in the file of the character whose behaviour changes, and an
 * `exclusive` one in the first of TPI's pair.
 */
import type { CharacterId } from './types.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, type Issues } from './validate.ts';

export interface JinxRules {
	exclusive?: true;
	notGiven?: true;
	givenInstead?: GivenInstead;
	noTurnGood?: true;
	spareToken?: true;
	storytellerPicksPlayer?: true;
}

export const GIVEN_INSTEAD = [
	'a-minion',
	'a-player-becomes',
	'demon-neighbour-becomes',
	'outsiders'
] as const;
export type GivenInstead = (typeof GIVEN_INSTEAD)[number];

export const JINX_RULE_KEYS = [
	'exclusive',
	'notGiven',
	'givenInstead',
	'noTurnGood',
	'spareToken',
	'storytellerPicksPlayer'
] as const;

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
		const instead = readEnum(entry, 'givenInstead', GIVEN_INSTEAD, at, issues, false);
		if (instead) rules.givenInstead = instead;
		if (readBoolean(entry, 'noTurnGood', at, issues)) rules.noTurnGood = true;
		if (readBoolean(entry, 'spareToken', at, issues)) rules.spareToken = true;
		if (readBoolean(entry, 'storytellerPicksPlayer', at, issues))
			rules.storytellerPicksPlayer = true;
		if (Object.keys(rules).length === 0) {
			issues.add(at, 'a jinx entry needs at least one rule');
			continue;
		}
		out[partner] = rules;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
