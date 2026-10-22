import { describe, expect, it } from 'vitest';
import { parseSpecialRule, specialRuleById } from '#lib/core/modes/index.ts';
import { INFINITE_NAMED, PLUS_ONE_NAMED, switched } from './rule-switches.ts';

describe('rule switches', () => {
	const plusOne = specialRuleById('plus-one')!;
	const infinite = specialRuleById('infinite-possibilities')!;

	it('leave a rule as its file has it until a switch is changed', () => {
		expect(switched(plusOne, {})).toEqual(plusOne);
		expect(switched(infinite, { 'infinite-possibilities:named': false })).toEqual(infinite);
	});

	it('name the extra characters on +1 and Infinite Possibilities, with no range offered', () => {
		const named = switched(plusOne, { 'plus-one:named': true });
		expect(named.parts.information?.[0]?.instructions).toBe(PLUS_ONE_NAMED);
		const many = switched(infinite, { 'infinite-possibilities:named': true });
		expect(many.parts.information).toEqual([{ instructions: INFINITE_NAMED }]);
		expect(many.parts.pool).toMatchObject({ announceRange: false, count: { min: 1, max: 4 } });
		// The copy a game keeps is still a valid rule file.
		expect(parseSpecialRule(many).ok).toBe(true);
	});
});
