/**
 * Which rules a jinx has, read for one character of the pair. Every jinx reader goes through
 * `rulesForJinx` (M40):
 * - a jinx the script holds itself (a script entry's `jinxes`, `Script.jinxes`) replaces TPI's
 *   for the pair, so only the script's rules count: the jinx entry's own `rules`, and a custom
 *   character's `rules.jinxes` for the partner. Our rules files are ignored for that pair, as
 *   the author chose the wording. With no rules at all the jinx is text, and only its wording
 *   may still say that just one of the two can be in play (`isExclusiveJinx`);
 * - otherwise the pair's rules come from both characters' `jinxes` blocks (`jinxRulesBetween`):
 *   a custom character's own `rules`, else our overlay file.
 * Each effect says whose behaviour it changes (`who`), so `owner`'s rules for a partner are the
 * effects on `owner` from both sides (`pairView`).
 */
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import type { JinxEffect, JinxRules } from '#lib/core/data/jinx-rules.ts';
import { flipCondition, subjectOf } from '#lib/core/data/jinx-needs.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId, Jinx } from '#lib/core/data/types.ts';

export type RulesLookup = ReadonlyMap<CharacterId, { rules?: CharacterRules }>;

/** Where a reader finds the script's own jinxes: the game's `Script`, or a loaded list. */
export interface JinxScope {
	readonly jinxes?: readonly Jinx[];
}

/**
 * Jinx text meaning "only one of these can be in play": TPI's "Only 1 jinxed character can be
 * in play", and a homebrew script's "Only one of the X and the Y may be in play", "cannot both
 * be in play" or "may not both be in play".
 */
const EXCLUSIVE = new RegExp(
	[
		String.raw`only (?:1|one) (?:jinxed )?characters? (?:can|may) be in play`,
		String.raw`only (?:1|one) of .+? (?:can|may) be in play`,
		String.raw`(?:cannot|can't|can not|may not|must not) both be in play`
	].join('|'),
	'i'
);

export function isExclusiveJinx(reason: string): boolean {
	return EXCLUSIVE.test(reason);
}

/** The script's own jinx between `a` and `b`, in either order; the last one when it has two. */
export function scriptJinxFor(
	scope: JinxScope | undefined,
	a: CharacterId,
	b: CharacterId
): Jinx | undefined {
	const list = scope?.jinxes ?? [];
	for (let i = list.length - 1; i >= 0; i--) {
		const [x, y] = list[i].characters;
		if ((x === a && y === b) || (x === b && y === a)) return list[i];
	}
	return undefined;
}

/** The partners `owner` has a jinx with on the script's own list. */
export function scriptJinxPartners(
	scope: JinxScope | undefined,
	owner: CharacterId
): CharacterId[] {
	return (scope?.jinxes ?? []).flatMap(({ characters: [x, y] }) =>
		x === owner && y !== owner ? [y] : y === owner && x !== owner ? [x] : []
	);
}

/**
 * What the jinx between `a` and `b` changes for `a`: from the script's own jinx for the pair
 * when it has one (its entry's `rules` and custom characters' `rules.jinxes`, never our files;
 * with none, `exclusive` only if its wording says so), else from both characters' `jinxes`
 * blocks (`jinxRulesBetween`). Undefined when nothing is about `a`.
 */
export function rulesForJinx(
	scope: JinxScope | undefined,
	a: CharacterId,
	b: CharacterId,
	characters?: RulesLookup
): JinxRules | undefined {
	if (a === b) return undefined;
	const own = scriptJinxFor(scope, a, b);
	if (!own) return jinxRulesBetween(a, b, characters);
	const side = (x: CharacterId, y: CharacterId): JinxRules | undefined => {
		const custom = characters?.get(x)?.rules?.jinxes?.[y];
		const written = own.characters[0] === x ? own.rules : undefined;
		return custom && written ? { ...custom, ...written } : (written ?? custom);
	};
	const mine = side(a, b);
	const theirs = side(b, a);
	if (!mine && !theirs) return isExclusiveJinx(own.reason) ? { exclusive: true } : undefined;
	return pairView(mine, theirs);
}

/**
 * What the jinx between `a` and `b` changes for `a`, from both characters' `jinxes` blocks:
 * `a`'s own effects (`who: "self"`) and `b`'s effects on its partner (`who: "partner"`), with
 * `b`'s conditions read from `a`'s side; an `exclusive` jinx either way, and `who: "both"`
 * from either. `who` is left out but for `both`. Undefined when nothing is about `a` (the jinx
 * may be text only). Were both files to set one effect, `a`'s own would win; loading reports
 * that as an error (`jinxPartnerIssues`). Readers use `rulesForJinx`, which lets a script's
 * own jinx replace this.
 */
export function jinxRulesBetween(
	a: CharacterId,
	b: CharacterId,
	characters?: RulesLookup
): JinxRules | undefined {
	return pairView(rulesOf(a, characters)?.jinxes?.[b], rulesOf(b, characters)?.jinxes?.[a]);
}

/** The effects on a pair's character from its own side's entry (`own`) and the partner's. */
export function pairView(
	own: JinxRules | undefined,
	theirs: JinxRules | undefined
): JinxRules | undefined {
	const out: Record<string, unknown> = {};
	const add = (rules: JinxRules | undefined, from: 'self' | 'partner') => {
		for (const [key, effect] of Object.entries(rules ?? {}) as [string, JinxEffect | true][]) {
			if (key in out) continue;
			if (effect === true) out[key] = true;
			else if (subjectOf(effect) !== (from === 'self' ? 'partner' : 'self'))
				out[key] = viewed(effect, from === 'partner');
		}
	};
	add(own, 'self');
	add(theirs, 'partner');
	return Object.keys(out).length > 0 ? (out as JinxRules) : undefined;
}

/** An effect without its `who` (but `both`), its conditions flipped when from the partner. */
function viewed(effect: JinxEffect, flip: boolean): JinxEffect {
	const { who, ...rest } = effect;
	const out: JinxEffect = who === 'both' ? { ...rest, who } : rest;
	return flip && out.when ? { ...out, when: out.when.map(flipCondition) } : out;
}
