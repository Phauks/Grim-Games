/**
 * Special rules people add themselves, as custom game modes are (custom-modes.svelte.ts): a
 * rule file pasted or uploaded in Add mode, checked with parseSpecialRule and kept on this
 * device. The key carries a version; a stored rule that no longer reads is dropped.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import {
	parseSpecialRule,
	SCRIPT_RULE_ID,
	SPECIAL_RULES,
	specialRuleById,
	type SpecialRule
} from '#lib/core/modes/index.ts';

const KEY = 'grim-games:custom-rules:v1';

function read(): SpecialRule[] {
	const raw = readStored(KEY);
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((r) => {
		const parsed = parseSpecialRule(r);
		return parsed.ok && !specialRuleById(parsed.rule.id) ? [parsed.rule] : [];
	});
}

let list = $state.raw<SpecialRule[]>(read());

function write(next: SpecialRule[]) {
	list = next;
	// Storage blocked: the rule stays for this visit only.
	writeStored(KEY, next);
}

export const customRules = {
	get list(): readonly SpecialRule[] {
		return list;
	},
	/** Saves a checked rule file, replacing one of the same id. */
	add(value: unknown, known?: ReadonlySet<CharacterId>) {
		const parsed = parseSpecialRule(value, known);
		if (!parsed.ok) return parsed;
		if (specialRuleById(parsed.rule.id) || parsed.rule.id === SCRIPT_RULE_ID)
			return { ok: false as const, issues: ['id: is a built-in rule; give your rule its own id'] };
		write([...list.filter((r) => r.id !== parsed.rule.id), parsed.rule]);
		return parsed;
	},
	remove(id: string): void {
		write(list.filter((r) => r.id !== id));
	}
};

/** A built-in rule, or one added on this device. */
export function findRule(id: string): SpecialRule | undefined {
	return specialRuleById(id) ?? list.find((r) => r.id === id);
}

/** Built-in rules then this device's own, for New game's Special rules. */
export function allRules(): readonly SpecialRule[] {
	return [...SPECIAL_RULES, ...list];
}
