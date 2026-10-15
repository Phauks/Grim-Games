import { describe, expect, it } from 'vitest';
import { fitTokens } from './fit.ts';

describe('fitTokens', () => {
	it('gives one token most of a phone screen, capped', () => {
		expect(fitTokens(1, 358, 500)).toEqual({ size: 320, columns: 1 });
	});

	it('stacks three tokens on a tall phone and lines them up on a wide tablet', () => {
		expect(fitTokens(3, 358, 900).columns).toBe(1);
		expect(fitTokens(3, 1000, 500).columns).toBe(3);
	});

	it('never goes below the minimum size', () => {
		expect(fitTokens(20, 200, 200).size).toBe(64);
		expect(fitTokens(0, 300, 300).size).toBe(64);
	});
});
