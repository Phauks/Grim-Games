/**
 * A script's own rule as a special rule: its Bootlegger lines (`_meta.bootlegger`), always on
 * when the script is played. A bracket in a line, such as Binary Supernovae's "[+1 Demon]"
 * (https://beardytas.com/garden-of-djinn/binary-supernovae/), is read into a count change the
 * same way as a homebrew character's brackets (`setup-modifiers.ts`), as the rule's
 * `setupModifier`. Setup applies that change through the Bootlegger in play
 * (`setupModifierFor`), not from the rule's own block, so a game never counts it twice.
 */
import type { CharacterId, ScriptMeta } from '#lib/core/data/types.ts';
import { modifierFromText } from '#lib/core/rules/setup-modifiers.ts';
import { scriptRules } from '#lib/core/data/script-rules.ts';
import { SPECIAL_RULE_FORMAT, type SpecialRule } from './types.ts';

/** The id of a script's own rule; no library or custom rule may use it. */
export const SCRIPT_RULE_ID = 'script';

export function scriptSpecialRule(
	meta: ScriptMeta | undefined,
	findByName?: (name: string) => CharacterId | undefined
): SpecialRule | undefined {
	const text = scriptRules(meta);
	if (!text.length) return undefined;
	const modifier = modifierFromText(
		{
			// Only the lines' text is read, so the rule stands in as its own character.
			id: SCRIPT_RULE_ID,
			name: meta?.name?.trim() || 'Script',
			type: 'loric',
			ability: text.join(' '),
			setup: true,
			reminders: [],
			remindersGlobal: [],
			special: []
		},
		findByName
	);
	return {
		kind: 'special-rule',
		format: SPECIAL_RULE_FORMAT,
		id: SCRIPT_RULE_ID,
		name: meta?.name?.trim() || 'Script',
		sources: [],
		parts: { text },
		...(modifier?.ops.length
			? { rules: { setupModifier: { summary: modifier.summary, ops: [...modifier.ops] } } }
			: {})
	};
}
