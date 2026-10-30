import { describe, expect, it } from 'vitest';
import { committedCharacter } from '#lib/core/testing/committed-data.ts';
import { seesGrimoire } from './sees-grimoire.ts';

describe('seesGrimoire', () => {
	// https://wiki.bloodontheclocktower.com/Spy: the Spy sees the Grimoire each night.
	it('is true for the Spy', () => {
		expect(seesGrimoire(committedCharacter('spy'))).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Widow: the Widow looks at it on the first night.
	it('is true for the Widow', () => {
		expect(seesGrimoire(committedCharacter('widow'))).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Poisoner: chooses a player, never sees the Grimoire.
	it('is false for a character that does not see it', () => {
		expect(seesGrimoire(committedCharacter('poisoner'))).toBe(false);
	});
});
