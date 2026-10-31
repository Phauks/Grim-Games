import { describe, expect, it } from 'vitest';
import { numberChoices } from './number-choices.ts';

describe('numberChoices', () => {
	it('lists every whole number from min to max', () => {
		expect(numberChoices(0, 3, 1)).toEqual([0, 1, 2, 3]);
	});

	it('lists only the given values in range', () => {
		expect(numberChoices(5, 60, 30, [1, 15, 30, 90])).toEqual([15, 30]);
	});

	it('keeps a current value that is not one of them, in order', () => {
		expect(numberChoices(5, 300, 31, [15, 30, 45])).toEqual([15, 30, 31, 45]);
	});

	it('lists the current value alone when the range is empty', () => {
		expect(numberChoices(3, 2, 3)).toEqual([3]);
	});
});
