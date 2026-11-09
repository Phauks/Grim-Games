/**
 * The Character builder's Rules section (M62, Trevor picked "Add a rule", 2026-11-09): the
 * rules block's parts as rows, each added or changed one at a time through its `field`, or as
 * its own rules text when the part has no field yet. Every key the form has no row for is kept.
 */
import * as PARTS from '#lib/core/data/parts/index.ts';
import type { PartField, Reminders } from '#lib/core/data/parts/part.ts';
import { Issues, isObject } from '#lib/core/data/validate.ts';
import type { CharacterFields } from './character-builder.ts';

/** One part a custom character's rules may have. */
export interface BuilderRule {
	/** The key in the rules block. */
	key: string;
	label: string;
	description: string;
	/** How it is edited; absent: as rules text. */
	field?: PartField;
}

/**
 * Parts set elsewhere, so never listed: the night position has its own field in Night (M59),
 * and night text replaces an official character's text only (P8: a custom character writes its
 * own in the Night section).
 */
const ELSEWHERE: ReadonlySet<string> = new Set(['nightOrder', 'nightText']);

/** Every part the Rules section can add, by label. */
export const BUILDER_RULES: readonly BuilderRule[] = Object.entries(PARTS)
	.filter(([key]) => !ELSEWHERE.has(key))
	.map(([key, part]): BuilderRule => {
		const rule: BuilderRule = { key, label: part.label, description: part.description };
		if (part.field) rule.field = part.field;
		return rule;
	})
	.sort((a, b) => a.label.localeCompare(b.label));

const BY_KEY = new Map(BUILDER_RULES.map((rule) => [rule.key, rule]));

/** The part `key` names; a key no part has (a typo, `optionalRule`) is edited as text. */
export function builderRule(key: string): BuilderRule {
	return BY_KEY.get(key) ?? { key, label: key, description: '' };
}

/** A row of the Rules section: one key of the block and its value as written. */
export interface RuleRow {
	rule: BuilderRule;
	value: unknown;
}

/** The block's rules in the order written, leaving out those set elsewhere. */
export function ruleRows(fields: CharacterFields): RuleRow[] {
	return Object.entries(fields.rules ?? {})
		.filter(([key, value]) => !ELSEWHERE.has(key) && value !== undefined)
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
export type { PartField } from '#lib/core/data/parts/part.ts';
