/**
 * Virgin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Virgin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Virgin.
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
import { characterNominationPrompts, mayNominate } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Virgin', () => {
	const character = committedCharacter('virgin');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Virgin');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('virgin')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Virgin#Examples)', () => {
		it('Example 1: Washerwoman nominates Virgin and is executed', () => {
			// Wiki: "The Washerwoman nominates the Virgin. The Washerwoman is immediately executed and the
			// day ends."
			const s = scenario(['washerwoman', 'virgin', 'imp', 'chef', 'poisoner']).nominate(
				'washerwoman',
				'virgin'
			);
			const nomination = { nominator: s.seat('washerwoman'), nominee: s.seat('virgin') };
			expect(characterNominationPrompts(s.game, nomination, s.characters)).toEqual([
				{ kind: 'execute-nominator', characterId: 'virgin', ...nomination }
			]);
		});
		it('Example 2: Drunk nominates Virgin and survives; vote follows', () => {
			// Wiki: "The Drunk, who thinks they are the Chef, nominates the Virgin. The Drunk remains
			// alive, and the Virgin loses their ability. Players may now vote on whether or not to execute
			// the Virgin. (This happens because the Drunk is not a Townsfolk.)"
			const s = scenario(['chef', 'virgin', 'imp', 'monk', 'poisoner'])
				.drunk('chef')
				.nominate('chef', 'virgin');
			const nomination = { nominator: s.seat('chef'), nominee: s.seat('virgin') };
			expect(characterNominationPrompts(s.game, nomination, s.characters)).toEqual([]);
			const spent = s.reminder('virgin', 'virgin', 'No Ability');
			const monk = { nominator: spent.seat('monk'), nominee: spent.seat('virgin') };
			expect(characterNominationPrompts(spent.game, monk, spent.characters)).toEqual([]);
		});
		it("Example 3: Dead nominator's nomination; ability intact", () => {
			// Wiki: "A dead player nominates the Virgin. The dead, however, cannot nominate. The
			// Storyteller declares that the nomination does not count. The Virgin does not lose their
			// ability."
			const s = scenario(['washerwoman', 'virgin', 'imp', 'chef', 'poisoner']).dies('chef');
			expect(mayNominate(s.game, s.seat('chef'), s.characters)).toBe(false);
			const nomination = { nominator: s.seat('washerwoman'), nominee: s.seat('virgin') };
			expect(characterNominationPrompts(s.game, nomination, s.characters)).toHaveLength(1);
		});
	});
});
