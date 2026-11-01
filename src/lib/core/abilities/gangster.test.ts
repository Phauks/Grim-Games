/**
 * Gangster: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gangster
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gangster.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Gangster', () => {
	const character = committedCharacter('gangster');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition carousel', () => {
			expect(character.name).toBe('Gangster');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('gangster')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gangster#Examples)', () => {
		it.todo('Example 1: Baron agrees, and the Saint dies');
		it.todo("Example 2: Engineer asks for Po's death; Gangster agrees");
		it.todo("Example 3: Fool's ability blocks Sage and Gangster's kill");
	});
});
