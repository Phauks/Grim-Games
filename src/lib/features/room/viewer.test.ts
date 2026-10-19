import { describe, expect, it } from 'vitest';
import { viewerKeyFrom } from './viewer.svelte.ts';

describe('the view-only link’s key', () => {
	it('is the 64 hex digits after the #', () => {
		const key = 'ab'.repeat(32);
		expect(viewerKeyFrom(`#${key}`)).toBe(key);
	});

	it('is missing from a link cut short or changed', () => {
		expect(viewerKeyFrom('')).toBeUndefined();
		expect(viewerKeyFrom('#1f')).toBeUndefined();
		expect(viewerKeyFrom(`#${'AB'.repeat(32)}`)).toBeUndefined();
	});
});
