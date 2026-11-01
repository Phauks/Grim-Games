/**
 * Soldier: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Soldier
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Soldier.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Soldier', () => {
	const character = committedCharacter('soldier');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Soldier');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('soldier')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Soldier#Examples)', () => {
		it('Example 1: Imp targets Soldier, so nobody dies', () => {
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).reminder(
				'soldier',
				'imp',
				'Dead'
			);
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					killer: 'imp',
					seatId: s.seat('soldier'),
					because: [
						{ kind: 'protected', source: { characterId: 'soldier', seatId: s.seat('soldier') } }
					]
				}
			]);
		});
		it("Example 2: Poisoned Soldier dies to Imp's attack", () => {
			// A poisoned Soldier has no ability, so nothing protects them.
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).poisoned('soldier');
			expect(protection(s.game, s.seat('soldier'), s.characters, 'demon')).toBeUndefined();
		});
		it("Example 3: Drunk Soldier dies from Imp's attack", () => {
			// A Drunk who thinks they are the Soldier is not the Soldier.
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).drunk('soldier');
			expect(protection(s.game, s.seat('soldier'), s.characters, 'demon')).toBeUndefined();
		});
	});
});
