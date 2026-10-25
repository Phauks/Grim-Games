import { describe, expect, it } from 'vitest';
import { parseSpecialRule, specialRuleById } from '#lib/core/modes/index.ts';
import {
	DJINN_THREE_ALIVE,
	DUPLICATE_DEMONS,
	INFINITE_NAMED,
	PLUS_ONE_NAMED,
	switched
} from './rule-switches.ts';

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

	// https://beardytas.com/garden-of-djinn/the-djinns-bargain/: the page's 3-player limit,
	// which the rule text leaves out (Trevor, 2026-10-23: a setting).
	it("add the Djinn's Bargain's 3-player limit to its instructions", () => {
		const bargain = specialRuleById('djinns-bargain')!;
		expect(switched(bargain, {})).toEqual(bargain);
		const limited = switched(bargain, { 'djinns-bargain:three-alive': true });
		expect(limited.parts.ruleChanges?.[0]?.instructions).toBe(
			`${bargain.parts.ruleChanges?.[0]?.instructions} ${DJINN_THREE_ALIVE}`
		);
		expect(limited.parts.nominations).toEqual([{ kind: 'nominator-may-die', minAlive: 4 }]);
		expect(parseSpecialRule(limited).ok).toBe(true);
	});

	// Trevor (2026-10-24): "allow duplicate demons could be a setting".
	it('let Demons repeat too under Duplicate Characters', () => {
		const rule = specialRuleById('duplicate-characters')!;
		expect(switched(rule, {})).toEqual(rule);
		const demons = switched(rule, { 'duplicate-characters:demons': true });
		expect(demons.parts.duplicates).toMatchObject({
			kind: 'allowed',
			notTypes: [],
			instructions: DUPLICATE_DEMONS
		});
		expect(parseSpecialRule(demons).ok).toBe(true);
	});
});
