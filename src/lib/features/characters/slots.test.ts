import { describe, expect, it } from 'vitest';
import { slot, splitSlots } from './slots.ts';

describe('slots', () => {
	it('splits a sentence into words and slot names', () => {
		expect(splitSlots(`Mark ${slot('who')} as used?`)).toEqual(['Mark ', 'who', ' as used?']);
		expect(splitSlots(`${slot('a')} and ${slot('b')}`)).toEqual(['', 'a', ' and ', 'b', '']);
		expect(splitSlots('No slots')).toEqual(['No slots']);
	});

	it('takes a seat id with hyphens as one slot', () => {
		// The Butler's vote note named its Master by a raw seat id (Trevor, 2026-11-02).
		const seatId = '28e73c51-1309-429c-ba90-002cb7c54146';
		expect(splitSlots(`Votes only if ${slot(seatId)} votes`)).toEqual([
			'Votes only if ',
			seatId,
			' votes'
		]);
	});
});
