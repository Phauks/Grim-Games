import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, parseAvatarId } from './index.ts';

describe('player avatars (plan R6)', () => {
	it('reads only the avatars in the set', () => {
		expect(parseAvatarId('cat')).toBe('cat');
		expect(parseAvatarId('skull')).toBeUndefined();
		expect(parseAvatarId(7)).toBeUndefined();
		expect(parseAvatarId(undefined)).toBeUndefined();
	});

	it('lists each avatar once', () => {
		expect(new Set(AVATAR_IDS).size).toBe(AVATAR_IDS.length);
	});
});
