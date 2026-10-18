import { describe, expect, it } from 'vitest';
import { fieldLabel } from './labels.ts';

describe('fieldLabel', () => {
	it('reads the pool’s count as hidden extras and a town’s count as towns', () => {
		// Trevor, 2026-10-18: Infinite Possibilities read as four fixed extras.
		expect(fieldLabel('pool', 'count')).toBe('Hidden extras in all');
		expect(fieldLabel('pool', 'extras')).toBe('Most of each type');
		expect(fieldLabel('towns', 'count')).toBe('Towns');
	});
});
