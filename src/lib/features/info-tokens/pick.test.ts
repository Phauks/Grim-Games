import { describe, expect, it } from 'vitest';
import { pickMax } from './pick.ts';

describe('pickMax', () => {
	it('lets "This player is" name several characters, e.g. for the Dreamer', () => {
		// https://wiki.bloodontheclocktower.com/Dreamer: the player learns one good and one evil character.
		expect(pickMax('this-player-is')).toBeGreaterThanOrEqual(2);
	});
	it('asks for 3 with "not in play" and 1 otherwise', () => {
		expect(pickMax('not-in-play')).toBe(3);
		expect(pickMax('you-are')).toBe(1);
	});
});
