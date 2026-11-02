/**
 * Heretic: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Heretic
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Heretic.
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
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Heretic', () => {
	const character = committedCharacter('heretic');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Heretic');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
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
			expect(nightSheetPresence('heretic')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Heretic#Examples)', () => {
		it('Example 1: Day-one claim prompts Demon suicide; evil wins', () => {
			// Wiki: "On the first day, the Heretic publicly claims to be the Heretic. That night, the
			// Demon kills themself. Evil wins."
			// A No Dashii, so no Minion takes over the Demon.
			const s = scenario(['heretic', 'chef', 'empath', 'monk', 'poisoner', 'nodashii'])
				.newDay()
				.dies('nodashii', 'nodashii');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([
				{
					rule: 'demon-dead',
					winner: 'evil',
					flippedBy: { characterId: 'heretic', seatId: s.seat('heretic') }
				}
			]);
			expect(suggestedWinner(ends)).toBe('evil');
		});
		it('Example 2: Heretic waits, forces good execution; good wins', () => {
			// Wiki: "The Heretic does not reveal their character until the final day, when 3 players are
			// alive. They convince the good team to execute a good player, leaving 2 players alive, one of
			// which is the Demon. Good wins."
			const s = scenario(['heretic', 'chef', 'empath', 'monk', 'poisoner', 'imp'])
				.dies('empath', 'imp')
				.dies('monk', 'imp')
				.dies('poisoner', 'execution')
				.newDay()
				.execute('chef');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'two-alive', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 3: Saint executed while Heretic dead; good wins', () => {
			// Wiki: "The Heretic is dead. The Saint is executed. Good wins."
			const s = scenario(['heretic', 'saint', 'chef', 'monk', 'poisoner', 'imp'])
				.dies('heretic', 'imp')
				.newDay()
				.execute('saint');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'executed-loses', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 4: Poisoned Heretic; Assassin kills Demon, good wins', () => {
			// Wiki: "The Heretic is poisoned. The Assassin kills the Demon. Good wins."
			const s = scenario(['heretic', 'chef', 'empath', 'monk', 'assassin', 'imp'])
				.poisoned('heretic')
				.dies('imp', 'assassin');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(ends[0].flippedBy).toBeUndefined();
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 5: Demon executed with three alive; evil wins', () => {
			// Wiki: "There are 3 players alive. The Demon is executed. Because there is a Heretic in play,
			// evil wins."
			const s = scenario(['heretic', 'chef', 'empath', 'monk', 'poisoner', 'imp'])
				.dies('empath', 'imp')
				.dies('monk', 'imp')
				.dies('poisoner', 'execution')
				.newDay()
				.execute('imp');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'evil' }]);
			expect(suggestedWinner(ends)).toBe('evil');
		});
	});
});
