/**
 * Lil' Monsta: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lil%27_Monsta
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lil' Monsta.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe("Lil' Monsta", () => {
	const character = committedCharacter('lilmonsta');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe("Lil' Monsta");
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Demon', 'Dead']);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lilmonsta')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'ability', name: 'pointing', time: 'night', global: 'minion' },
				{ type: 'selection', name: 'bag-disabled' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Examples)', () => {
		it.todo('Example 1: Minions pass the baby from Widow to Poisoner');
	});
});
