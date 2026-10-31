/**
 * Harlot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Harlot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Harlot.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Harlot', () => {
	const character = committedCharacter('harlot');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Harlot');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('harlot')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Harlot#Examples)', () => {
		it.todo('Example 1: Good Harlot dies with the Mutant they learned');
		it.todo('Example 2: Evil Harlot falsely claims revealed Sage is Witch');
	});
});
