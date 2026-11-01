/**
 * Scarlet Woman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Scarlet_Woman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Scarlet Woman.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Scarlet Woman', () => {
	const character = committedCharacter('scarletwoman');

	describe('data (roles.json)', () => {
		it('is a Minion from edition tb', () => {
			expect(character.name).toBe('Scarlet Woman');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Is The Demon']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('scarletwoman')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Scarlet_Woman#Examples)', () => {
		it.todo('Example 1: Executing Imp with Travellers present ends game');
		it.todo('Example 2: Five players alive: Scarlet Woman becomes Imp');
		it.todo("Example 3: Fortune Teller's answer flips after Imp dies");
	});
});
