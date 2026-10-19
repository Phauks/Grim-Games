import { describe, expect, it } from 'vitest';
import { chainLabel, detailLabel, moved } from './chain.ts';

describe('cards shown together', () => {
	it('names a card by its words, answer and characters', () => {
		const names = (ids: readonly string[]) => ids.join(', ');
		expect(chainLabel({ text: 'You are', characterIds: ['empath'] }, names)).toBe(
			'You are (empath)'
		);
		expect(detailLabel({ text: 'Your number is', characterIds: [], detail: '2' })).toBe(
			'Your number is: 2'
		);
		// Yes/No shows only its answer.
		expect(detailLabel({ text: '', characterIds: [], detail: 'Yes' })).toBe('Yes');
	});

	it('moves a card up or down, never past either end', () => {
		expect(moved(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
		expect(moved(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
	});
});
