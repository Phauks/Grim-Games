/**
 * Fang Gu: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fang_Gu
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fang Gu.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { gameEnds, starPass } from '#lib/core/rules/game-end.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Fang Gu', () => {
	const character = committedCharacter('fanggu');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Fang Gu');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Once']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('fanggu')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fang_Gu#Examples)', () => {
		it('Example 1: Fang Gu kills an Outsider and jumps, kills again', () => {
			// Wiki: "The Fang Gu attacks the Artist, who dies. The next night, the Fang Gu attacks the
			// Sweetheart, who becomes the Fang Gu while the old Fang Gu dies. The Sweetheart does not
			// make a player drunk, because they did not die. The next night, the new Fang Gu attacks
			// the Klutz, who dies."
			const first = scenario(['fanggu', 'artist', 'sweetheart', 'klutz', 'chef', 'witch'])
				.dies('artist', 'fanggu')
				.newDay();
			expect(gameEnds(first.game, first.characters)).toEqual([]);
			// The old Fang Gu dies by its own kill and spends its one jump.
			const jumping = first.reminder('fanggu', 'fanggu', 'Once').dies('fanggu', 'fanggu');
			expect(starPass(jumping.game, jumping.characters)).toEqual({
				characterId: 'fanggu',
				heirs: [jumping.seat('sweetheart'), jumping.seat('klutz')]
			});
			const jumped = jumping.becomes('sweetheart', 'fanggu', 'evil').newDay();
			expect(jumped.game.seats[jumped.seat('sweetheart')]).toMatchObject({
				characterId: 'fanggu',
				alignment: 'evil',
				dead: false
			});
			expect(gameEnds(jumped.game, jumped.characters)).toEqual([]);
			// The new Fang Gu kills the Klutz; no second jump is offered.
			const third = jumped.dies('klutz', 'fanggu');
			expect(third.game.seats[third.seat('klutz')].dead).toBe(true);
			expect(starPass(third.game, third.characters)).toBeUndefined();
		});
	});
});
