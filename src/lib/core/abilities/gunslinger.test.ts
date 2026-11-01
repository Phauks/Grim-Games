/**
 * Gunslinger: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gunslinger
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gunslinger.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Gunslinger', () => {
	const character = committedCharacter('gunslinger');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Gunslinger');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('gunslinger')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gunslinger#Examples)', () => {
		it.todo("Example 1: Voter shot; Imp's execution still proceeds");
		it.todo("Example 2: Only the day's first vote tally counts");
	});
});
