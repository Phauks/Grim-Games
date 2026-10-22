import type { SpecialRule } from '#lib/core/modes/index.ts';

/**
 * A built-in rule's own switch on New game, under the rule's description in the Special rules
 * dialog (Trevor, 2026-10-22: "add setting for +1"). On, it changes the copy of the rule the
 * game keeps; the rule file itself never changes.
 */
export interface RuleSwitch {
	/** i18n key of the switch's label. */
	label: 'modes.plusOneNamed';
	apply: (rule: SpecialRule) => SpecialRule;
}

/** +1's two instructions, both Trevor's wording (2026-10-22); the first is the rule's own. */
export const PLUS_ONE_NAMED = 'Tell the table which character from off the script is in play.';

export const RULE_SWITCHES: Readonly<Record<string, RuleSwitch>> = {
	'plus-one': {
		label: 'modes.plusOneNamed',
		apply: (rule) => ({
			...rule,
			parts: {
				...rule.parts,
				information: (rule.parts.information ?? []).map((item, i) =>
					i === 0 ? { ...item, instructions: PLUS_ONE_NAMED } : item
				)
			}
		})
	}
};

/** The rule as the game plays it, with its switch applied when on. */
export function switched(rule: SpecialRule, on: readonly string[]): SpecialRule {
	const sw = RULE_SWITCHES[rule.id];
	return sw && on.includes(rule.id) ? sw.apply(rule) : rule;
}
