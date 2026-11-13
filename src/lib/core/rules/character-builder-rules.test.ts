/**
 * The Character builder's Rules section (M62): rows for the rules block, one rule changed at a
 * time, each checked as a loaded script would check it.
 */
import { describe, expect, it } from 'vitest';
import type { ReminderLabel } from '#lib/core/data/index.ts';
import type { FieldSpec } from '#lib/core/data/field-spec.ts';
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
	it('lists every part but the two set elsewhere and our own words, by label', () => {
		const keys = BUILDER_RULES.map((r) => r.key);
		expect(keys).not.toContain('nightOrder');
		expect(keys).not.toContain('nightText');
		// Our own wording of an official optional rule is never typed in (M84).
		expect(keys).not.toContain('optionalRuleText');
		expect(keys).toHaveLength(Object.keys(PARTS).length - 3);
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

/** Each setting the builder shows as typed text, by its path; a spec seen is skipped. */
function typed(spec: FieldSpec, path: string, seen = new Set<FieldSpec>()): string[] {
	if (seen.has(spec)) return [];
	seen.add(spec);
	switch (spec.kind) {
		case 'string':
		case 'strings':
		case 'text':
			return [path];
		case 'object':
			return spec.fields
				.filter((f) => !f.spec.official)
				.flatMap((f) => typed(f.spec, `${path}.${f.key}`, seen));
		case 'variants':
			return spec.variants.flatMap((v) => typed(v.spec, `${path}<${v.label}>`, seen));
		case 'list':
		case 'byToken':
		case 'byKey':
		case 'byCharacter':
			return typed(spec.of, `${path}.*`, seen);
		default:
			return [];
	}
}

/**
 * Settings still typed in (M84, Trevor 2026-11-12: "lean against" free text): names of
 * existing things are picked, and our own words for official characters are left out. What
 * is left is words a custom character needs (what a prep step asks for, what a day reminder
 * says) or a mix of keywords and names the pickers can't offer yet. Only shrinks.
 */
const TYPED_TODO = [
	'afterDeath.cause',
	'dayReminders.reminders.*.template.*<Text>.text',
	'dayReminders.reminders.*.when.cause',
	'dayTally.label',
	'evilLearns.named',
	'infoTokenCharacters.*<One step>.characters',
	'infoTokenCharacters.*<One step>.value',
	'jinxes.*.cannotCreate<With who and when>.when.*<Marked>.marked',
	'jinxes.*.patch<With who and when>.parts',
	'reminderTargets.*.neighbour.of',
	'setupModifier.summary',
	'setupModifier.requires',
	'setupModifier.notes',
	'setupPrep.notes.*.value.key',
	'setupPrep.notes.*.value.label'
];

describe('typed settings', () => {
	it('picks names from lists and leaves out our own words (M84)', () => {
		const shown = BUILDER_RULES.flatMap((r) => typed(r.field, r.key));
		expect(shown.filter((p) => !TYPED_TODO.includes(p))).toEqual([]);
		expect(TYPED_TODO.filter((p) => !shown.includes(p))).toEqual([]);
	});
});
