/**
 * Jinxes on a script. If the script holds any jinxed pair, the Djinn is in play and every
 * jinx on the script is announced at the start, even for characters not in play
 * (https://wiki.bloodontheclocktower.com/Djinn). Some jinxes say only one of the pair can
 * be in play (Heretic with Baron, Godfather, Lleech, Pit-Hag, Spy, Widow:
 * https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes); those become setup
 * warnings when both are chosen.
 *
 * What a jinx changes in the app is data: the `jinxes` block of either character's rules
 * (`data/jinx-rules.ts`), in effect while both are on the script. A jinx with no such block
 * (a homebrew one) is text, except that its wording may still say only one can be in play.
 */
import type { JinxRules } from '#lib/core/data/jinx-rules.ts';
import type { JinxIndex } from '#lib/core/data/jinxes.ts';
import { pairKey } from '#lib/core/data/parse.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import type { CharacterId, Jinx } from '#lib/core/data/types.ts';

type RulesLookup = ReadonlyMap<CharacterId, { rules?: CharacterRules }>;

export interface ScriptJinx extends Jinx {
	/** `official` from TPI's jinxes.json; `script` from a homebrew character's `jinxes`. */
	source: 'official' | 'script';
	/** The jinx forbids both characters being in play at once. */
	exclusive: boolean;
}

/** Jinx text meaning "only one of these can be in play". */
const EXCLUSIVE = /only (?:1|one) (?:jinxed )?character can be in play|cannot both be in play/i;

export function isExclusiveJinx(reason: string): boolean {
	return EXCLUSIVE.test(reason);
}

/**
 * What the jinx between `a` and `b` changes, from both characters' `jinxes` blocks, or
 * undefined when neither says anything (the jinx is text only).
 */
export function jinxRulesBetween(
	a: CharacterId,
	b: CharacterId,
	characters?: RulesLookup
): JinxRules | undefined {
	const fromA = rulesOf(a, characters)?.jinxes?.[b];
	const fromB = rulesOf(b, characters)?.jinxes?.[a];
	return fromA || fromB ? { ...fromB, ...fromA } : undefined;
}

/** Whether a jinx forbids both being in play: its rules say so, else its wording does. */
export function jinxIsExclusive(jinx: Jinx, characters?: RulesLookup): boolean {
	const [a, b] = jinx.characters;
	const rules = jinxRulesBetween(a, b, characters);
	return rules ? rules.exclusive === true : isExclusiveJinx(jinx.reason);
}

/**
 * The abilities `giver`'s `givesAbility` may not give on this script: each jinxed partner
 * on it whose jinx says `notGiven` (the Boffin's Demon cannot have the Drunk ability,
 * https://wiki.bloodontheclocktower.com/Boffin#Related_Jinxes).
 */
export function barredAbilities(
	giver: CharacterId,
	script: readonly CharacterId[],
	characters?: RulesLookup
): CharacterId[] {
	return script.filter(
		(id) => id !== giver && jinxRulesBetween(giver, id, characters)?.notGiven === true
	);
}

/**
 * Every jinx between characters on the script: TPI's, plus any declared by homebrew
 * characters. A homebrew jinx replaces TPI's for the same pair, since the script author
 * chose it. Order: TPI's data order, then the script's.
 */
export function scriptJinxes(
	index: JinxIndex,
	scriptIds: Iterable<CharacterId>,
	homebrewJinxes: readonly Jinx[] = [],
	characters?: RulesLookup
): ScriptJinx[] {
	const ids = new Set(scriptIds);
	const own = new Map<string, Jinx>();
	for (const jinx of homebrewJinxes) {
		const [a, b] = jinx.characters;
		if (ids.has(a) && ids.has(b) && a !== b) own.set(pairKey(a, b), jinx);
	}
	const out: ScriptJinx[] = [];
	for (const jinx of index.all) {
		const [a, b] = jinx.characters;
		if (!ids.has(a) || !ids.has(b) || own.has(pairKey(a, b))) continue;
		out.push({ ...jinx, source: 'official', exclusive: jinxIsExclusive(jinx, characters) });
	}
	for (const jinx of own.values()) {
		// The script's own wording replaces TPI's jinx, so it is read as written.
		out.push({ ...jinx, source: 'script', exclusive: isExclusiveJinx(jinx.reason) });
	}
	return out;
}

export interface JinxSetupWarning {
	characters: readonly [CharacterId, CharacterId];
	message: string;
	jinx: ScriptJinx;
}

/**
 * Setup warnings for exclusive jinxes where both characters were chosen. `names` turns ids
 * into display names.
 */
export function jinxSetupWarnings(
	jinxes: readonly ScriptJinx[],
	inPlay: Iterable<CharacterId>,
	names: (id: CharacterId) => string = (id) => id
): JinxSetupWarning[] {
	const chosen = new Set(inPlay);
	return jinxes
		.filter((j) => j.exclusive && chosen.has(j.characters[0]) && chosen.has(j.characters[1]))
		.map((jinx) => {
			const [a, b] = jinx.characters;
			return {
				characters: jinx.characters,
				jinx,
				message: `${names(a)} and ${names(b)} are jinxed: only one of them can be in play.`
			};
		});
}

/** The jinxes that involve characters actually in play (for the grimoire, not the sheet). */
export function activeJinxes(
	jinxes: readonly ScriptJinx[],
	inPlay: Iterable<CharacterId>
): ScriptJinx[] {
	const chosen = new Set(inPlay);
	return jinxes.filter((j) => chosen.has(j.characters[0]) && chosen.has(j.characters[1]));
}

/**
 * The jinxes to show on one character's night step or day row: those involving it whose both
 * characters are in play, in the order given. A jinx counts while both are in play, so the
 * Storyteller sees it where either character is run (https://wiki.bloodontheclocktower.com/Djinn).
 */
export function jinxesOnStep<J extends Jinx>(
	jinxes: readonly J[],
	characterId: CharacterId,
	inPlay: Iterable<CharacterId>
): J[] {
	const chosen = new Set(inPlay);
	if (!chosen.has(characterId)) return [];
	return jinxes.filter(
		({ characters: [a, b] }) =>
			(a === characterId && chosen.has(b)) || (b === characterId && chosen.has(a))
	);
}
