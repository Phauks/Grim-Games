/**
 * A script's own rule as a special rule: its Bootlegger lines (`_meta.bootlegger`), always on
 * when the script is played. A bracket in a line, such as Binary Supernovae's "[+1 Demon]"
 * (https://beardytas.com/garden-of-djinn/binary-supernovae/), is read into a count change the
 * same way as a homebrew character's brackets (`setup-modifiers.ts`). Setup applies that change
 * through the Bootlegger in play (`setupModifierFor`), not from these `countChanges`, so a game
 * never counts it twice.
 */
import type { CharacterId, ScriptMeta } from '#lib/core/data/types.ts';
import { modifierFromText } from '#lib/core/rules/setup-modifiers.ts';
import { BOOTLEGGER, scriptRules } from '#lib/core/rules/script-rules.ts';
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
			id: BOOTLEGGER,
			name: 'Bootlegger',
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
		parts: { text, ...(modifier?.ops.length ? { countChanges: [...modifier.ops] } : {}) }
	};
}
