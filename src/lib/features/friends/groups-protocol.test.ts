import { describe, expect, it } from 'vitest';
import {
	formatGroupCode,
	groupLink,
	MAX_GROUP_NAME,
	normaliseGroupCode,
	normaliseGroupName,
	readGroupLink
} from './groups-protocol.ts';

// Plan F6 (Trevor, 2026-10-31): a group has a join code people type or scan.
describe('group codes', () => {
	it('reads a code as typed, in any case, with or without its dash', () => {
		expect(normaliseGroupCode('abcd-2345')).toBe('ABCD2345');
		expect(normaliseGroupCode(' ABCD 2345 ')).toBe('ABCD2345');
	});

	it('refuses a code of the wrong length or with letters it never uses', () => {
		expect(normaliseGroupCode('ABCD234')).toBeUndefined();
		expect(normaliseGroupCode('ABCD2340')).toBeUndefined();
		expect(normaliseGroupCode('ABCDI234')).toBeUndefined();
		expect(normaliseGroupCode(42)).toBeUndefined();
	});

	it('shows a code in two halves', () => {
		expect(formatGroupCode('ABCD2345')).toBe('ABCD-2345');
	});

	it('round-trips a group link, and ignores other links', () => {
		const link = groupLink('https://grimbinder.com', 'ABCD2345');
		expect(link).toBe('https://grimbinder.com/friends#group=ABCD2345');
		expect(readGroupLink(link)).toBe('ABCD2345');
		expect(readGroupLink('#group=abcd-2345')).toBe('ABCD2345');
		expect(readGroupLink('https://grimbinder.com/play#group=ABCD2345')).toBeUndefined();
		expect(readGroupLink('#friend=ann')).toBeUndefined();
	});
});

describe('group names', () => {
	it('trims, folds spaces and cuts to length', () => {
		expect(normaliseGroupName('  Board  game cafe ')).toBe('Board game cafe');
		expect(normaliseGroupName('x'.repeat(100))).toHaveLength(MAX_GROUP_NAME);
	});

	it('refuses an empty name', () => {
		expect(normaliseGroupName('   ')).toBeUndefined();
		expect(normaliseGroupName(undefined)).toBeUndefined();
	});
});
