import { describe, expect, it } from 'vitest';
import { largestFit } from './largest-fit.ts';

describe('largestFit', () => {
	it('finds the largest scale that still fits, within a small step', () => {
		const scale = largestFit((s) => s <= 2.37, { min: 1, max: 6 });
		expect(scale).toBeLessThanOrEqual(2.37);
		expect(scale).toBeGreaterThan(2.36);
	});

	it('keeps the smallest scale when nothing fits', () => {
		expect(largestFit(() => false, { min: 1, max: 6 })).toBe(1);
	});

	it('takes the largest scale when everything fits', () => {
		expect(largestFit(() => true, { min: 0.3, max: 6 })).toBe(6);
	});

	it('can shrink below 1 when the range allows it', () => {
		const scale = largestFit((s) => s <= 0.5, { min: 0.3, max: 6 });
		expect(scale).toBeGreaterThan(0.49);
		expect(scale).toBeLessThanOrEqual(0.5);
	});
});
