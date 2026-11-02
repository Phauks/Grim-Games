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
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { carriesDemonToken } from '#lib/core/rules/death-causes.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { nightTextPlain, nightTextSegments, placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';

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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Lil%27_Monsta#How_to_Run)', () => {
		const cast = ['poisoner', 'widow', 'chef', 'empath', 'monk', 'mayor', 'soldier'];
		const data = committedGameData();
		const textFor = (night: 'first' | 'other') => {
			const placeholders = placeholdersFor(character, night);
			const reminder =
				night === 'first' ? character.firstNightReminder! : character.otherNightReminder!;
			return nightTextPlain(
				nightTextSegments(reminder, character, { ...(placeholders ? { placeholders } : {}) })
			);
		};

		it('deals an extra Minion instead of the Demon', () => {
			// Wiki: "During setup, remove Lil’ Monsta and add a Minion token."
			const inPlay = [...cast, 'lilmonsta'].map((id) => data.byId.get(id)!);
			const result = analyseSetup({ players: 7, inPlay });
			expect(result.expected.demon).toEqual([0]);
			expect(result.expected.minion).toEqual([2]);
			expect(result.warnings).toEqual([]);
		});

		it.fails('skips the Minion Info and Demon Info steps on the first night', () => {
			// Wiki: "On the first night, skip the MINION INFO and DEMON INFO steps."
			// Waits on the engine (unplanned): the night order keeps Minion Info and Demon Info with Lil' Monsta in play, as its rules don't remove the evil team's info.
			const inPlay = [...cast, 'lilmonsta'].map((id) => data.byId.get(id)!);
			const { steps } = nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 7 });
			expect(steps.map((step) => step.id)).not.toContain('minioninfo');
			expect(steps.map((step) => step.id)).not.toContain('demoninfo');
		});

		it('puts Is The Demon on the living player the Minions choose', () => {
			// Wiki: "Each night, wake all Minions. The majority will (eventually) point to one player.
			// If they can’t decide, choose a player. (Give this player the Lil’ Monsta token and wait for
			// them to hide it, if you want!) Mark them with the IS THE DEMON reminder token."
			expect(textFor('first')).toContain('[+Is The Demon]');
			expect(textFor('other')).toContain('[+Is The Demon]');
			const s = scenario(cast).dies('soldier');
			const token = { characterId: 'lilmonsta', label: 'Is The Demon' };
			expect(reminderTargetMisses(s.game, token, s.seat('widow'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('soldier'), s.characters)).toEqual([
				'life'
			]);
		});

		it('may kill a player on nights after the first only', () => {
			// Wiki: "Then, if it is not the first night, a player might die – mark them with a DEAD
			// reminder and a shroud."
			expect(textFor('first')).not.toContain('[+Dead]');
			expect(textFor('other')).toContain('[+Dead]');
		});

		it('gives good the win when the player marked Is The Demon dies at night', () => {
			// Wiki: "The player marked IS THE DEMON registers as the Demon. If they die, declare that
			// the game is over and good has won."
			const s = scenario(cast)
				.reminder('widow', 'lilmonsta', 'Is The Demon')
				.dies('widow', 'lilmonsta');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good', seats: [s.seat('widow')] }
			]);
		});
	});
});
