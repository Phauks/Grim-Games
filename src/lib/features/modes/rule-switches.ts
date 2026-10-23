import type { SpecialRule } from '#lib/core/modes/index.ts';

/**
 * A built-in rule's own switches on New game, under the rule in the Special rules dialog
 * (Trevor, 2026-10-22: "add setting for +1"; then the same settings for A Script of Infinite
 * Possibilities). A switch changes the copy of the rule the game keeps; the rule file itself
 * never changes.
 */
export interface RuleSwitch {
	id: string;
	/** i18n key of the switch's label. */
	label: 'modes.switch.named' | 'modes.switch.threeAlive';
	/** How the rule file plays without the switch being touched. */
	default: boolean;
	apply: (rule: SpecialRule, on: boolean) => SpecialRule;
}

/** The Storyteller's switch choices, by `ruleId:switchId`; a missing one is its default. */
export type SwitchChoices = Readonly<Record<string, boolean>>;

/** +1's two instructions, both Trevor's wording (2026-10-22); the first is the rule's own. */
export const PLUS_ONE_NAMED = 'Tell the table which character from off the script is in play.';
/** Our draft for Infinite Possibilities' named setting; hidden until approved. */
export const INFINITE_NAMED = 'Tell the table which characters from off the script are in play.';

/**
 * +1 and Infinite Possibilities are the same part underneath (hidden characters from off the
 * script, `script-plus-hidden`), so they share these switches (Trevor, 2026-10-22: "internally
 * they are very similar"; they stay two rules).
 */
const EXTRAS: readonly RuleSwitch[] = [
	{
		id: 'named',
		label: 'modes.switch.named',
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
		label: 'modes.switch.threeAlive',
		default: false,
		apply: (rule, on) => {
			if (!on) return rule;
			const [first, ...rest] = rule.parts.ruleChanges ?? [];
			return {
				...rule,
				parts: {
					...rule.parts,
					ruleChanges: [
						{ ...first, instructions: `${first?.instructions ?? ''} ${DJINN_THREE_ALIVE}`.trim() },
						...rest
					]
				}
			};
		}
	}
];

export const RULE_SWITCHES: Readonly<Record<string, readonly RuleSwitch[]>> = {
	'plus-one': EXTRAS,
	'infinite-possibilities': EXTRAS,
	'djinns-bargain': DJINN
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
