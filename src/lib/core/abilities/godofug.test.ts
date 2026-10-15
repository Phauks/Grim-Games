/**
 * God of Ug: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/God_of_Ug
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes God of Ug.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('God of Ug', () => {
	const character = committedCharacter('godofug');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('God of Ug');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Hat']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('godofug')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'vote', name: 'multiplier', value: 2 },
				{ type: 'reminder', name: 'public' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/God_of_Ug#Examples)', () => {
		it.todo('Example 1: Player keeps the hat by speaking simply');
		it.todo('Example 2: Long word passes the hat on');
	});
});
