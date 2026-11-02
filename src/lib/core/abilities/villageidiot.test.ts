/**
 * Village Idiot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Village_Idiot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Village Idiot.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';

describe('Village Idiot', () => {
	const character = committedCharacter('villageidiot');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Village Idiot');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('villageidiot')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'selection', name: 'bag-duplicate' }]);
		});
	});

	// Summary: up to 2 extra Village Idiots, so 3 at most (M22).
	describe('setup copies', () => {
		const data = committedGameData();
		const cast = (idiots: number) => [
			...Array.from({ length: idiots }, () => data.byId.get('villageidiot')!),
			...['chef', 'empath', 'monk', 'saint', 'imp', 'poisoner'].map((id) => data.byId.get(id)!)
		];
		const duplicate = (idiots: number) =>
			analyseSetup({ players: 6 + idiots, inPlay: cast(idiots) }).warnings.filter(
				(w) => w.code === 'duplicate'
			);
		it('allows three Village Idiots', () => {
			expect(duplicate(3)).toEqual([]);
		});
		it('warns at four', () => {
			expect(duplicate(4)).toHaveLength(1);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Village_Idiot#Examples)', () => {
		it.todo('Example 1: Drunk Village Idiot misreads; others correct');
		it.todo('Example 2: Drunk Village Idiot reads Heretic; liar fakes Village Idiot');
	});
});
