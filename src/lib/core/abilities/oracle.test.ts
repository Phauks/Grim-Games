/**
 * Oracle: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Oracle
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Oracle.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Oracle', () => {
	const character = committedCharacter('oracle');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Oracle');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('oracle')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Oracle#Examples)', () => {
		it.todo('Example 1: Every dead player is good, so zero');
		it.todo('Example 2: Evil dead reach four after a Minion dies');
	});
});
