import { describe, expect, it } from 'vitest';
import { slot, splitSlots } from './slots.ts';

describe('slots', () => {
	it('splits a sentence into words and slot names', () => {
		expect(splitSlots(`Mark ${slot('who')} as used?`)).toEqual(['Mark ', 'who', ' as used?']);
		expect(splitSlots(`${slot('a')} and ${slot('b')}`)).toEqual(['', 'a', ' and ', 'b', '']);
		expect(splitSlots('No slots')).toEqual(['No slots']);
	});
});
