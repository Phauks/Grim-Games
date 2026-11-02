/**
 * Ojo: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Ojo
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Ojo.
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
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Ojo', () => {
	const character = committedCharacter('ojo');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Ojo');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('ojo')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Ojo#Examples)', () => {
		it.fails('Example 1: Ojo names absent Empath, so Shugenja dies', () => {
			// Wiki: "The Ojo chooses the Plague Doctor. The Plague Doctor dies. The next night, the Ojo
			// chooses the Poppy Grower. The Poppy Grower dies. The next night, the Ojo chooses the Empath.
			// There is no Empath in play, so the Storyteller chooses that the Shugenja dies instead."
			const s = scenario(['ojo', 'plaguedoctor', 'poppygrower', 'shugenja', 'chef', 'poisoner'])
				.dies('plaguedoctor', 'ojo')
				.newDay()
				.dies('poppygrower', 'ojo')
				.newDay();
			expect(s.game.seating.some((id) => s.game.seats[id].characterId === 'empath')).toBe(false);
			engineGap(
				'unplanned',
				"the Ojo's night step names a character: that character's player dies, or with none in play the Storyteller picks who dies (the Shugenja)"
			);
		});
	});
});
