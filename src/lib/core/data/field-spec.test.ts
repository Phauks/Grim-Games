/** The Character builder's field descriptions (M62): labels, empty values and coverage. */
import { describe, expect, it } from 'vitest';
import {
	byCharacter,
	CHARACTER,
	COUNT,
	emptyFor,
	fieldLabel,
	INT,
	obj,
	oneOf,
	opt,
	optionLabel,
	startFor,
	startVariant,
	summaryOf,
	T,
	TOKEN,
	uncovered,
	variantOf,
	variants,
	type FieldSpec
} from './field-spec.ts';

describe('labels', () => {
	it('names a setting from its key in the game’s words', () => {
		expect(fieldLabel('spentToken')).toBe('Spent reminder');
		expect(fieldLabel('tokens')).toBe('Reminders');
		expect(fieldLabel('whileNeighboursGood')).toBe('While neighbours good');
		expect(optionLabel('not-execution')).toBe('not execution');
	});

	it('sums a value up on one line', () => {
		expect(summaryOf({ who: 'marked', token: 'Lit', night: true })).toBe(
			'Who marked · Reminder Lit · Night'
		);
		expect(summaryOf(['Lit', 'Out'])).toBe('Lit, Out');
	});
});

describe('uncovered', () => {
	const protects = obj({ who: oneOf(['self', 'marked']), token: opt(TOKEN), weight: opt(INT) });

	it('finds nothing in a value the fields hold', () => {
		expect(uncovered(protects, { who: 'marked', token: 'Lit', weight: -1 })).toEqual([]);
	});

	it('finds a setting, a choice and a missing value the fields do not hold', () => {
		expect(uncovered(protects, { who: 'all', extra: 1 })).toEqual(['.extra', '.who']);
		expect(uncovered(protects, {})).toEqual(['.who']);
	});

	it('tells variants apart by a key or by kind', () => {
		const spec = variants(
			{ label: 'A', has: 'none', spec: obj({ none: oneOf(['x']) }) },
			{ label: 'B', is: 'string', spec: oneOf(['dawn']) }
		) as Extract<FieldSpec, { kind: 'variants' }>;
		expect(variantOf(spec, { none: 'x' })).toBe(0);
		expect(variantOf(spec, 'dawn')).toBe(1);
		expect(variantOf(spec, 3)).toBe(-1);
		expect(emptyFor(spec)).toEqual({});
	});
});

describe('kinds added for jinxes (M79)', () => {
	it('tells a value switched on or a number apart from an object', () => {
		const spec = variants(
			{ label: 'On', is: 'true', spec: T },
			{ label: 'Short', is: 'number', spec: COUNT },
			{ label: 'Full', is: 'object', spec: obj({ dead: COUNT }) }
		) as Extract<FieldSpec, { kind: 'variants' }>;
		expect(variantOf(spec, true)).toBe(0);
		expect(variantOf(spec, 2)).toBe(1);
		expect(variantOf(spec, { dead: 2 })).toBe(2);
		expect(uncovered(spec, false)).toEqual(['(value)']);
	});

	it('holds a character and entries keyed by one', () => {
		expect(uncovered(CHARACTER, 'empath')).toEqual([]);
		expect(uncovered(byCharacter(T), { empath: true, chef: 1 })).toEqual(['.chef']);
		expect(emptyFor(byCharacter(T))).toEqual({});
	});

	it('starts a setting on its first choice, and a kind with its telling key', () => {
		expect(startFor(oneOf(['a', 'b']))).toBe('a');
		expect(startFor(COUNT)).toBe(1);
		expect(startVariant({ label: 'Day', has: 'day', spec: obj({ day: COUNT }) })).toEqual({
			day: 1
		});
		expect(startVariant({ label: 'On', is: 'true', spec: T })).toBe(true);
	});
});
