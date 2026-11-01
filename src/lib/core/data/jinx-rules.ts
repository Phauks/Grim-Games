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
 *
 * Either character's file may hold the block; the app reads both sides (`rules/jinxes.ts`).
 * By convention it goes in the file of the character whose behaviour changes, and an
 * `exclusive` one in the first of TPI's pair.
 */
import type { CharacterId } from './types.ts';
import { checkKeys, describe, isObject, readBoolean, type Issues } from './validate.ts';

export interface JinxRules {
	exclusive?: true;
	notGiven?: true;
}

export const JINX_RULE_KEYS = ['exclusive', 'notGiven'] as const;

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
		if (Object.keys(rules).length === 0) {
			issues.add(at, 'a jinx entry needs at least one rule');
			continue;
		}
		out[partner] = rules;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
