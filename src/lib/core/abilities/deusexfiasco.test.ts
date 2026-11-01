/**
 * Deus ex Fiasco: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Deus_ex_Fiasco
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Deus ex Fiasco.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Deus ex Fiasco', () => {
	const character = committedCharacter('deusexfiasco');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition carousel', () => {
			expect(character.name).toBe('Deus ex Fiasco');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Whoopsie']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('deusexfiasco')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Deus_ex_Fiasco#Examples)', () => {
		it.todo('Example 1: Mayor shown; Ravenkeeper secretly made Drunk');
		it.todo('Example 2: Empath given wrong number, fixed next night');
		it.todo('Example 3: Undertaker shown wrong token, corrected next night');
		it.todo('Example 4: Premature game-over call; Scarlet Woman lives');
		it.todo('Example 5: Wrong deaths announced for two players');
		it.todo('Example 6: Poisoner missed a wake; gets extra targets');
		it.todo('Example 7: Chambermaid picks dead player; wrong info given');
	});
});
