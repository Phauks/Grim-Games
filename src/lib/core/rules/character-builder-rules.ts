/**
 * The Character builder's Rules section (M62, Trevor picked "Add a rule", 2026-11-09): the
 * rules block's parts as rows, each added or changed one at a time through its `field`. A key
 * no part has is edited as rules text, and every key the form has no row for is kept.
 */
import * as PARTS from '#lib/core/data/parts/index.ts';
import type { PartField, Reminders, RuleGroup } from '#lib/core/data/parts/part.ts';
import { TEXT, uncovered } from '#lib/core/data/field-spec.ts';
import { Issues, isObject } from '#lib/core/data/validate.ts';
import type { CharacterFields } from './character-builder.ts';

/** One part a custom character's rules may have. */
export interface BuilderRule {
	/** The key in the rules block. */
	key: string;
	/** Where it belongs in a game; none for a key no part has. */
	group?: RuleGroup;
	label: string;
	description: string;
	/** How it is edited: its fields, or rules text. */
	field: PartField;
}

/**
 * Parts set elsewhere, so never listed: the night position has its own field in Night (M59),
 * and night text replaces an official character's text only (P8: a custom character writes its
 * own in the Night section). A custom character's setup change is its ability's [setup] text,
 * built with Add a setup change and read by the app, so what it says is what it does (Trevor,
 * 2026-11-12: "if it says +2 outsiders it actually is"); a setup change rule beside it could
 * say one thing and do another.
 */
const ELSEWHERE: ReadonlySet<string> = new Set(['nightOrder', 'nightText', 'setupModifier']);

/** Whether the Rules section offers part `key`: not set elsewhere, nor our own words (M84). */
const offered = (key: string) =>
	!ELSEWHERE.has(key) &&
	!(PARTS as Record<string, { field?: { official?: true } }>)[key]?.field?.official;

/** Every part the Rules section can add, by label. */
export const BUILDER_RULES: readonly BuilderRule[] = Object.entries(PARTS)
	.filter(([key]) => offered(key))
	.map(([key, part]): BuilderRule => ({
		key,
		group: part.group,
		label: part.label,
		description: part.description,
		field: part.field
	}))
	.sort((a, b) => a.label.localeCompare(b.label));

/** The rules whose name or description has every word of `query`, in any order. */
export function findRules(rules: readonly BuilderRule[], query: string): BuilderRule[] {
	const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	return rules.filter((rule) => {
		const text = `${rule.label} ${rule.description}`.toLocaleLowerCase();
		return words.every((word) => text.includes(word));
	});
}

const BY_KEY = new Map(BUILDER_RULES.map((rule) => [rule.key, rule]));

/** The part `key` names; a key no part has (a typo, `optionalRule`) is edited as text. */
export function builderRule(key: string): BuilderRule {
	return BY_KEY.get(key) ?? { key, label: key, description: '', field: TEXT };
}

/** A row of the Rules section: one key of the block and its value as written. */
export interface RuleRow {
	rule: BuilderRule;
	value: unknown;
}

/** The block's rules in the order written, leaving out those set elsewhere. */
export function ruleRows(fields: CharacterFields): RuleRow[] {
	return Object.entries(fields.rules ?? {})
		.filter(([key, value]) => offered(key) && value !== undefined)
		.map(([key, value]) => ({ rule: builderRule(key), value }));
}

/** The rules with `key` set to `value` (or removed when undefined), every other key kept. */
export function withRule(
	fields: CharacterFields,
	key: string,
	value: unknown
): Record<string, unknown> | undefined {
	const rules = { ...fields.rules };
	if (value === undefined) delete rules[key];
	else rules[key] = value;
	return Object.keys(rules).length ? rules : undefined;
}

/**
 * What is wrong with `value` as the rule `key`, as a loaded script would report it, read
 * inside the rest of the block (a jinx checks the rules it builds on). `reminders` are the
 * character's own reminder labels.
 */
export function ruleProblems(
	fields: CharacterFields,
	key: string,
	value: unknown,
	reminders: Reminders
): string[] {
	const issues = new Issues();
	const block = { ...fields.rules, [key]: value };
	if (key === 'optionalRule') {
		if (!isObject(value)) issues.add(`rules.${key}`, 'expected object');
	} else if (key in PARTS) {
		PARTS[key as keyof typeof PARTS].read(block, key, 'rules', issues, reminders);
	} else {
		issues.add(`rules.${key}`, 'unknown rule');
	}
	return issues.list;
}

/** Whether `value` can be edited with the rule's fields without losing any of it. */
export function fitsFields(rule: BuilderRule, value: unknown): boolean {
	return (
		rule.field.kind !== 'text' && (value === undefined || !uncovered(rule.field, value).length)
	);
}

/** A rule's value as rules text, to edit it. */
export function ruleText(value: unknown): string {
	return value === undefined ? '' : JSON.stringify(value, null, 2);
}

/** Rules text read back: its value, or why it can't be read. */
export function readRuleText(text: string): { value: unknown } | { error: string } {
	if (!text.trim()) return { error: 'empty' };
	try {
		return { value: JSON.parse(text) as unknown };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}
