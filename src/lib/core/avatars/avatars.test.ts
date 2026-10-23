import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, initialsOf, parseAvatarId } from './index.ts';

describe('player avatars (plan R6)', () => {
	it('reads only the avatars in the set', () => {
		expect(parseAvatarId('initials')).toBe('initials');
		// A picture from the earlier icon set is dropped (Trevor, 2026-10-23: initials for now).
		expect(parseAvatarId('cat')).toBeUndefined();
		expect(parseAvatarId(7)).toBeUndefined();
		expect(parseAvatarId(undefined)).toBeUndefined();
	});

	it('lists each avatar once', () => {
		expect(new Set(AVATAR_IDS).size).toBe(AVATAR_IDS.length);
	});

	it("takes a player's initials from their first and last words", () => {
		expect(initialsOf('Alex')).toBe('A');
		expect(initialsOf('mary ann lee')).toBe('ML');
		expect(initialsOf('  Sam   Ng ')).toBe('SN');
		expect(initialsOf('Émile Zola')).toBe('ÉZ');
		expect(initialsOf('🦊 Fox')).toBe('🦊F');
		expect(initialsOf('   ')).toBe('');
	});
});
