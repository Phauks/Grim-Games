import { describe, expect, it } from 'vitest';
import { tileLabel, tileLetters } from './tile-face.ts';

describe('tile labels', () => {
	it('letters run A to Z, then AA, AB', () => {
		expect([1, 2, 26, 27, 28, 52, 53].map(tileLetters)).toEqual([
			'A',
			'B',
			'Z',
			'AA',
			'AB',
			'AZ',
			'BA'
		]);
	});

	it('numbers by default, letters when chosen', () => {
		expect(tileLabel(3, 'numbers')).toBe('3');
		expect(tileLabel(3, 'letters')).toBe('C');
	});
});
