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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
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
			// Wiki: "The Imp attacks the Soldier. The Soldier does not die, so nobody dies that night."
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
			// Wiki: "The Poisoner poisons the Soldier, then the Imp attacks the Soldier. The Soldier dies,
			// since they have no ability."
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).poisoned('soldier');
			expect(protection(s.game, s.seat('soldier'), s.characters, 'demon')).toBeUndefined();
		});
		it("Example 3: Drunk Soldier dies from Imp's attack", () => {
			// Wiki: "The Imp attacks the Soldier. The Soldier dies, because they are actually the Drunk."
			const s = scenario(['soldier', 'chef', 'imp', 'monk', 'poisoner']).drunk('soldier');
			expect(protection(s.game, s.seat('soldier'), s.characters, 'demon')).toBeUndefined();
		});
	});
});
