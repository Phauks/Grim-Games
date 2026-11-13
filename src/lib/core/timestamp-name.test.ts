import { describe, expect, it } from 'vitest';
import { timestampName } from './timestamp-name.ts';

describe('timestamp names', () => {
	const when = new Date(2026, 9, 8, 7, 5);

	it('writes the local date and time, padded', () => {
		expect(timestampName(when)).toBe('2026-10-08 07:05');
	});
});
