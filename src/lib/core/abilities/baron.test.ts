/**
 * Baron: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Baron
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Baron.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Baron', () => {
	const character = committedCharacter('baron');

	describe('data (roles.json)', () => {
		it('is a Minion from edition tb', () => {
			expect(character.name).toBe('Baron');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('baron')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Baron#Examples)', () => {
		it.todo('Example 1: Seven players: Baron adds two Outsiders');
		it.todo('Example 2: Hidden Drunk is actually an Outsider');
	});
});
