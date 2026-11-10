/**
 * The Character builder's Rules section (M62): rows for the rules block, one rule changed at a
 * time, each checked as a loaded script would check it.
 */
import { describe, expect, it } from 'vitest';
import type { ReminderLabel } from '#lib/core/data/index.ts';
import * as PARTS from '#lib/core/data/parts/index.ts';
import { characterEntry, emptyCharacterFields, type CharacterFields } from './character-builder.ts';
import {
	BUILDER_RULES,
	builderRule,
	fitsFields,
	readRuleText,
	ruleProblems,
	ruleRows,
	ruleText,
	withRule
} from './character-builder-rules.ts';

function fields(over: Partial<CharacterFields> = {}): CharacterFields {
	return { ...emptyCharacterFields(), name: 'Lamplighter', reminders: ['Lit'], ...over };
}
const LIT = ['Lit'] as ReminderLabel[];

describe('BUILDER_RULES', () => {
	it('lists every part but the two set elsewhere, by label', () => {
		const keys = BUILDER_RULES.map((r) => r.key);
		expect(keys).not.toContain('nightOrder');
		expect(keys).not.toContain('nightText');
		expect(keys).toHaveLength(Object.keys(PARTS).length - 2);
		const labels = BUILDER_RULES.map((r) => r.label);
		expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
	});

	it('gives every rule fields of its own', () => {
		expect(builderRule('wish').field).toEqual({ kind: 'true' });
		expect(builderRule('protects').field.kind).toBe('object');
		expect(BUILDER_RULES.filter((r) => r.field.kind === 'text')).toEqual([]);
	});

	it('reads a key no part has as text', () => {
		expect(builderRule('typo')).toEqual({
			key: 'typo',
			label: 'typo',
			description: '',
			field: { kind: 'text' }
		});
	});

	it('edits a value with fields only when they hold all of it', () => {
		const protects = builderRule('protects');
		expect(fitsFields(protects, { who: 'self', from: 'demon' })).toBe(true);
		expect(fitsFields(protects, { who: 'self', from: 'demon', later: true })).toBe(false);
		expect(fitsFields(builderRule('typo'), true)).toBe(false);
	});
});

describe('ruleRows and withRule', () => {
	it('lists the rules as written, leaving out the night position', () => {
		const f = fields({
			rules: { nightOrder: { other: { after: 'monk' } }, wish: true, protects: { who: 'self' } }
		});
		expect(ruleRows(f).map((r) => r.rule.key)).toEqual(['wish', 'protects']);
	});

	it('sets and removes one rule, keeping the others', () => {
		const f = fields({ rules: { nightOrder: { other: { after: 'monk' } } } });
		const added = withRule(f, 'wish', true);
		expect(added).toEqual({ nightOrder: { other: { after: 'monk' } }, wish: true });
		expect(withRule(fields({ rules: added }), 'wish', undefined)).toEqual({
			nightOrder: { other: { after: 'monk' } }
		});
		expect(withRule(fields({ rules: { wish: true } }), 'wish', undefined)).toBeUndefined();
	});

	it('goes into the saved character', () => {
		const f = fields({ ability: 'x', rules: withRule(fields(), 'wish', true) });
		expect(characterEntry(f).rules).toEqual({ wish: true });
	});
});

describe('ruleProblems', () => {
	it('accepts a rule a script would load', () => {
		const value = { who: 'marked', token: 'Lit', from: 'any', night: true };
		expect(ruleProblems(fields(), 'protects', value, LIT)).toEqual([]);
	});

	it('reports a setting the rule does not have', () => {
		const problems = ruleProblems(fields(), 'protects', { who: 'all', from: 'any' }, LIT);
		expect(problems.join()).toContain('rules.protects.who');
	});

	it('reports a reminder the character does not have', () => {
		const value = { who: 'marked', token: 'Safe', from: 'demon' };
		expect(ruleProblems(fields(), 'protects', value, LIT)).toEqual([
			'rules.protects.token: not one of this character’s reminders'
		]);
	});

	it('reports an unknown rule', () => {
		expect(ruleProblems(fields(), 'typo', true, LIT)).toEqual(['rules.typo: unknown rule']);
	});
});

describe('rules text', () => {
	it('round-trips a value', () => {
		const value = { who: 'self', from: 'demon' };
		expect(readRuleText(ruleText(value))).toEqual({ value });
	});

	it('says why text cannot be read', () => {
		expect(readRuleText('{ who')).toHaveProperty('error');
		expect(readRuleText('  ')).toEqual({ error: 'empty' });
	});
});
