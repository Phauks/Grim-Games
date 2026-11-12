import { describe, expect, it } from 'vitest';
import { parseSpecialRule, specialRuleById } from '#lib/core/modes/index.ts';
import {
	DJINN_THREE_ALIVE,
	DUPLICATE_DEMONS,
	INFINITE_NAMED,
	PLUS_ONE_MAY_BE,
	PLUS_ONE_NAMED,
	choicesOf,
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
		expect(named.setup.information?.[0]?.instructions).toBe(PLUS_ONE_NAMED);
		const many = switched(infinite, { 'infinite-possibilities:named': true });
		expect(many.setup.information).toEqual([{ instructions: INFINITE_NAMED }]);
		expect(many.setup.pool).toMatchObject({ announceRange: false, count: { min: 1, max: 4 } });
		// The copy a game keeps is still a valid rule file.
		expect(parseSpecialRule(many).ok).toBe(true);
	});

	// Trevor (2026-10-22): +1 and Infinite Possibilities "alwasy have those added to the bag",
	// and a game where they may or may not be in play "would be beneficial to be built".
	it('let +1 and Infinite Possibilities deal none, with +1 telling the table one may be', () => {
		const none = switched(plusOne, { 'plus-one:may-be-none': true });
		expect(none.setup.pool).toMatchObject({ count: { min: 0, max: 1 } });
		expect(none.setup.information?.[0]?.instructions).toBe(PLUS_ONE_MAY_BE);
		expect(parseSpecialRule(none).ok).toBe(true);
		// Named, the Storyteller names it, or says none is.
		const named = switched(plusOne, { 'plus-one:named': true, 'plus-one:may-be-none': true });
		expect(named.setup.information?.[0]?.instructions).toBe(PLUS_ONE_NAMED);
		expect(named.setup.pool).toMatchObject({ count: { min: 0, max: 1 } });
		const many = switched(infinite, { 'infinite-possibilities:may-be-none': true });
		expect(many.setup.pool).toMatchObject({ announceRange: true, count: { min: 0, max: 4 } });
		expect(many.setup.information).toBeUndefined();
		expect(choicesOf([none, many], (id) => specialRuleById(id))).toEqual({
			'plus-one:may-be-none': true,
			'infinite-possibilities:may-be-none': true
		});
	});

	// https://beardytas.com/garden-of-djinn/the-djinns-bargain/: the page's 3-player limit,
	// which the rule text leaves out (Trevor, 2026-10-23: a setting).
	it("add the Djinn's Bargain's 3-player limit to its instructions", () => {
		const bargain = specialRuleById('djinns-bargain')!;
		expect(switched(bargain, {})).toEqual(bargain);
		const limited = switched(bargain, { 'djinns-bargain:three-alive': true });
		expect(limited.setup.ruleChanges?.[0]?.instructions).toBe(
			`${bargain.setup.ruleChanges?.[0]?.instructions} ${DJINN_THREE_ALIVE}`
		);
		expect(limited.rules?.onNominated).toEqual({ effect: 'nominator-may-die', minAlive: 4 });
		expect(parseSpecialRule(limited).ok).toBe(true);
	});

	// Trevor (2026-10-24): "allow duplicate demons could be a setting".
	it('let Demons repeat too under Duplicate Characters', () => {
		const rule = specialRuleById('duplicate-characters')!;
		expect(switched(rule, {})).toEqual(rule);
		const demons = switched(rule, { 'duplicate-characters:demons': true });
		expect(demons.setup.duplicates).toMatchObject({
			kind: 'allowed',
			notTypes: [],
			instructions: DUPLICATE_DEMONS
		});
		expect(parseSpecialRule(demons).ok).toBe(true);
	});

	it('read back from the kept rules, so Character selection shows them as set', () => {
		const find = (id: string) => specialRuleById(id);
		const named = switched(plusOne, { 'plus-one:named': true });
		expect(choicesOf([named, infinite], find)).toEqual({ 'plus-one:named': true });
		expect(choicesOf([plusOne], find)).toEqual({});
	});
});
