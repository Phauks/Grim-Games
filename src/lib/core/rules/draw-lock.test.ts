import { describe, expect, it } from 'vitest';
import { FORGOT_WAIT_MS, MAX_WAIT_MS, secondsLeft, waitAfter } from './draw-lock.ts';

describe('waitAfter', () => {
	it('lets the first two wrong PINs through without a wait', () => {
		expect(waitAfter(0)).toBe(0);
		expect(waitAfter(1)).toBe(0);
		expect(waitAfter(2)).toBe(0);
	});

	it('waits 30 seconds after the third, doubling for each one after', () => {
		expect(waitAfter(3)).toBe(30_000);
		expect(waitAfter(4)).toBe(60_000);
		expect(waitAfter(5)).toBe(120_000);
		expect(waitAfter(6)).toBe(240_000);
	});

	it('never waits longer than five minutes', () => {
		expect(waitAfter(7)).toBe(MAX_WAIT_MS);
		expect(waitAfter(50)).toBe(MAX_WAIT_MS);
	});
});

describe('secondsLeft', () => {
	it('rounds up to whole seconds and stops at zero', () => {
		expect(secondsLeft(FORGOT_WAIT_MS, 0)).toBe(60);
		expect(secondsLeft(10_000, 8_500)).toBe(2);
		expect(secondsLeft(10_000, 10_000)).toBe(0);
		expect(secondsLeft(10_000, 20_000)).toBe(0);
	});
});
