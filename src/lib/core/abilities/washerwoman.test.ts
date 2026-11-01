/**
 * Washerwoman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Washerwoman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Washerwoman.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Washerwoman', () => {
	const character = committedCharacter('washerwoman');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Washerwoman');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Townsfolk', 'Wrong']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('washerwoman')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Washerwoman#Examples)', () => {
		it('Example 1: Chef is one of two named players', () => {
			// Shown the Chef and the Ravenkeeper's players, as the Chef: true.
			const s = scenario(['washerwoman', 'chef', 'ravenkeeper', 'imp', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('chef'), s.seat('ravenkeeper')], characterId: 'chef' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 2: Virgin is one of two players', () => {
			// The other player shown may be anyone, even the Imp.
			const s = scenario(['washerwoman', 'imp', 'virgin', 'monk', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('imp'), s.seat('virgin')], characterId: 'virgin' };
			expect(isTruthful(picker, shown)).toBe(true);
		});

		it('Example 3: Spy masquerades as Ravenkeeper alongside another player', () => {
			// The Spy may register as a Townsfolk, here the Ravenkeeper, beside the Scarlet Woman.
			const s = scenario(['washerwoman', 'spy', 'scarletwoman', 'imp', 'chef']);
			const picker = infoPicker(s.game, s.seat('washerwoman'), 'washerwoman', s.characters)!;
			const shown = { seats: [s.seat('spy'), s.seat('scarletwoman')], characterId: 'ravenkeeper' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
	});
});
