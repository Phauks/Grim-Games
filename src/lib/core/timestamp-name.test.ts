import { describe, expect, it } from 'vitest';
import { nameOrTimestamp, timestampName } from './timestamp-name.ts';

describe('timestamp names', () => {
	const when = new Date(2026, 9, 8, 7, 5);

	it('writes the local date and time, padded', () => {
		expect(timestampName(when)).toBe('2026-10-08 07:05');
	});

	it('keeps a name that is given and replaces a blank one', () => {
		expect(nameOrTimestamp('  Storm Front ', when)).toBe('Storm Front');
		expect(nameOrTimestamp('   ', when)).toBe('2026-10-08 07:05');
		expect(nameOrTimestamp(undefined, when)).toBe('2026-10-08 07:05');
	});
});
