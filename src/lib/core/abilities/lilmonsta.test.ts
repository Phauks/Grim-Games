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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { carriesDemonToken } from '#lib/core/rules/death-causes.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

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
		it('Example 1: Minions pass the baby from Widow to Poisoner', () => {
			// Wiki: "The Poisoner and the Widow wake. They point at each other, then point at themselves,
			// then eventually both point at the Widow, who receives Lil’ Monsta’s token. The next night,
			// they both choose that the Poisoner babysits Lil’ Monsta instead."
			const s = scenario(['poisoner', 'widow', 'chef', 'empath', 'monk', 'mayor']).reminder(
				'widow',
				'lilmonsta',
				'Is The Demon'
			);
			expect(carriesDemonToken(s.game, s.seat('widow'), s.characters)).toBe(true);
			expect(carriesDemonToken(s.game, s.seat('poisoner'), s.characters)).toBe(false);
			const token = s.game.seats[s.seat('widow')].reminders[0];
			const next = s.newDay().do((at) => ({
				type: 'MoveReminder',
				reminderId: token.reminderId,
				toSeatId: at.seat('poisoner')
			}));
			expect(carriesDemonToken(next.game, next.seat('poisoner'), next.characters)).toBe(true);
			expect(carriesDemonToken(next.game, next.seat('widow'), next.characters)).toBe(false);
			// The babysitter is the Demon: executing the Poisoner now ends the game.
			const executed = next.execute('poisoner');
			expect(gameEnds(executed.game, executed.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good', seats: [executed.seat('poisoner')] }
			]);
		});
	});
});
