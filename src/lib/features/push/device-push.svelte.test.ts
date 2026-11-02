import { describe, expect, it } from 'vitest';
import { parsePushUses } from './device-push.svelte.ts';

describe('push uses on this device', () => {
	it('counts a subscription from before invites as Back to town', () => {
		expect(parsePushUses(undefined, true)).toEqual(['call-town']);
		expect(parsePushUses(undefined, false)).toEqual([]);
	});

	it('keeps the stored uses, and drops anything it does not know', () => {
		expect(parsePushUses(['invites'], true)).toEqual(['invites']);
		expect(parsePushUses(['call-town', 'invites', 'other', 3], true)).toEqual([
			'call-town',
			'invites'
		]);
		expect(parsePushUses([], true)).toEqual([]);
	});
});
