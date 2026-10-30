import type { SpecialRule } from '#lib/core/modes/index.ts';

/**
 * A built-in rule's own switches on New game, under the rule in the Special rules dialog
 * (Trevor, 2026-10-22: "add setting for +1"; then the same settings for A Script of Infinite
 * Possibilities). A switch changes the copy of the rule the game keeps; the rule file itself
 * never changes.
 */
export interface RuleSwitch {
	id: string;
	/** i18n key of the switch's label, which may depend on the rule it belongs to. */
	label: (ruleId: string) => SwitchLabel;
	/** How the rule file plays without the switch being touched. */
	default: boolean;
	apply: (rule: SpecialRule, on: boolean) => SpecialRule;
}

export type SwitchLabel =
	| 'modes.switch.namedOne'
	| 'modes.switch.namedMany'
	| 'modes.switch.threeAlive'
	| 'modes.switch.duplicateDemons';

/** The Storyteller's switch choices, by `ruleId:switchId`; a missing one is its default. */
export type SwitchChoices = Readonly<Record<string, boolean>>;

/** +1's two instructions, both Trevor's wording (2026-10-22); the first is the rule's own. */
export const PLUS_ONE_NAMED = 'Tell the table which character from off the script is in play.';
/** Infinite Possibilities' named setting, our wording (approved 2026-10-23). */
export const INFINITE_NAMED = 'Tell the table which characters from off the script are in play.';

/**
 * +1 and Infinite Possibilities are the same part underneath (hidden characters from off the
 * script, `script-plus-hidden`), so they share these switches (Trevor, 2026-10-22: "internally
 * they are very similar"; they stay two rules).
 */
const EXTRAS: readonly RuleSwitch[] = [
	{
		id: 'named',
		// Trevor (2026-10-23): "Storyteller Announces Character"; plural for Infinite
		// Possibilities, which may hide several.
		label: (ruleId) => (ruleId === 'plus-one' ? 'modes.switch.namedOne' : 'modes.switch.namedMany'),
		default: false,
		apply: (rule, on) => {
			if (!on) return rule;
			const text = rule.id === 'plus-one' ? PLUS_ONE_NAMED : INFINITE_NAMED;
			const [first, ...rest] = rule.parts.information ?? [];
			const pool = rule.parts.pool;
			return {
				...rule,
				parts: {
					...rule.parts,
					// Naming them says more than a range, so no range is offered.
					...(pool?.kind === 'script-plus-hidden'
						? { pool: { ...pool, announceRange: false } }
						: {}),
					information: [{ ...first, instructions: text }, ...rest]
				}
			};
		}
	}
];

/** The Djinn's Bargain's 3-player limit, from the author's notes; our wording (approved). */
export const DJINN_THREE_ALIVE =
	'While only 3 players are alive, no one may choose to die this way.';

/**
 * The Djinn's Bargain's page (https://beardytas.com/garden-of-djinn/the-djinns-bargain/) bars
 * the bargain while only 3 players live, a line its rule text leaves out (Trevor, 2026-10-23:
 * "include the 3-player limit as a setting"). Off by default, as the rule text plays.
 */
const DJINN: readonly RuleSwitch[] = [
	{
		id: 'three-alive',
		label: () => 'modes.switch.threeAlive',
		default: false,
		apply: (rule, on) => {
			if (!on) return rule;
			const [first, ...rest] = rule.parts.ruleChanges ?? [];
			return {
				...rule,
				parts: {
					...rule.parts,
					// The prompt on a nomination is offered only while 4 or more live.
					...(rule.parts.nominations
						? { nominations: rule.parts.nominations.map((n) => ({ ...n, minAlive: 4 })) }
						: {}),
					ruleChanges: [
						{ ...first, instructions: `${first?.instructions ?? ''} ${DJINN_THREE_ALIVE}`.trim() },
						...rest
					]
				}
			};
		}
	}
];

/** Duplicate Characters with Demons repeating too; our wording (approved 2026-10-26). */
export const DUPLICATE_DEMONS = 'You may put more than one copy of a character in the bag.';

/**
 * Duplicate Characters keeps Demons to one copy each, since several could make a game too hard
 * to win; this switch lets them repeat as well (Trevor, 2026-10-24: "allow duplicate demons
 * could be a setting"). Off by default.
 */
const DUPLICATES: readonly RuleSwitch[] = [
	{
		id: 'demons',
		label: () => 'modes.switch.duplicateDemons',
		default: false,
		apply: (rule, on) => {
			const duplicates = rule.parts.duplicates;
			if (!on || duplicates?.kind !== 'allowed') return rule;
			return {
				...rule,
				parts: {
					...rule.parts,
					duplicates: {
						...duplicates,
						notTypes: duplicates.notTypes?.filter((type) => type !== 'demon'),
						instructions: DUPLICATE_DEMONS
					}
				}
			};
		}
	}
];

export const RULE_SWITCHES: Readonly<Record<string, readonly RuleSwitch[]>> = {
	'plus-one': EXTRAS,
	'infinite-possibilities': EXTRAS,
	'djinns-bargain': DJINN,
	'duplicate-characters': DUPLICATES
};

/** Whether a rule's switch is on. */
export function switchOn(choices: SwitchChoices, ruleId: string, sw: RuleSwitch): boolean {
	return choices[`${ruleId}:${sw.id}`] ?? sw.default;
}

/** The rule as the game plays it, with its switches applied. */
export function switched(rule: SpecialRule, choices: SwitchChoices): SpecialRule {
	return (RULE_SWITCHES[rule.id] ?? []).reduce(
		(r, sw) => sw.apply(r, switchOn(choices, rule.id, sw)),
		rule
	);
}

/**
 * The switch choices a game's kept rules were made with, read back from the rules themselves
 * (a game keeps each rule as switched), so Character selection's Special rules shows them as
 * they were set. A rule whose file is gone keeps its defaults.
 */
export function choicesOf(
	rules: readonly SpecialRule[],
	find: (id: string) => SpecialRule | undefined
): SwitchChoices {
	const out: Record<string, boolean> = {};
	for (const rule of rules) {
		const base = find(rule.id);
		if (!base) continue;
		for (const sw of RULE_SWITCHES[rule.id] ?? []) {
			const flipped = switched(base, { [`${rule.id}:${sw.id}`]: !sw.default });
			if (JSON.stringify(flipped) === JSON.stringify(rule))
				out[`${rule.id}:${sw.id}`] = !sw.default;
		}
	}
	return out;
}
