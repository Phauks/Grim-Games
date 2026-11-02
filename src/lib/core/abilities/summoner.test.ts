/**
 * Summoner: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Summoner
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Summoner.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/becomes.ts';
import { dayNumber, nightOrder } from '#lib/core/rules/night-order.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';

describe('Summoner', () => {
	const character = committedCharacter('summoner');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Summoner');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Night 1', 'Night 2', 'Night 3']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('summoner')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Summoner#Examples)', () => {
		it('Example 1: Summoner turns Snitch into Lleech', () => {
			// Wiki: "On the third night, the Summoner chooses the Snitch player, and the Lleech. The
			// Snitch becomes the evil Lleech, and chooses a player to poison, and a player to kill."
			const night3 = scenario(['summoner', 'snitch', 'chef', 'empath', 'monk', 'mayor'])
				.newDay()
				.newDay()
				.reminder('summoner', 'summoner', 'Night 3');
			expect(characterChanger(night3.game, 'summoner', night3.characters)).toBe(
				night3.seat('summoner')
			);
			expect(changeableSeats(night3.game, 'summoner', night3.characters)).toContain(
				night3.seat('snitch')
			);
			const s = night3.becomes('snitch', 'lleech', 'evil');
			expect(s.game.seats[s.seat('snitch')]).toMatchObject({
				characterId: 'lleech',
				alignment: 'evil'
			});
			// A Demon is in play now, so the game goes on.
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it('Example 2: Summoner executed on day one; good wins', () => {
			// Wiki: "On the first day, the Summoner is executed. Good wins."
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'summoner'])
				.newDay()
				.execute('summoner');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'dead-without-demon', winner: 'good' }
			]);
		});
		it('Example 3: Alchemist turned into Leviathan, revealed at dawn', () => {
			// Wiki: "On the third night, the Summoner turns the Alchemist into the Leviathan. At dawn,
			// all players learn that Leviathan is in play, and that it is day three of five."
			const night3 = scenario(['summoner', 'alchemist', 'chef', 'empath', 'monk', 'mayor'])
				.newDay()
				.newDay()
				.reminder('summoner', 'summoner', 'Night 3');
			expect(characterChanger(night3.game, 'summoner', night3.characters)).toBe(
				night3.seat('summoner')
			);
			const s = night3.becomes('alchemist', 'leviathan', 'evil');
			const steps = nightOrder({
				night: 'other',
				sheet: committedGameData().nightSheet,
				players: s.game.seating.length,
				inPlay: ['summoner', 'leviathan', 'chef', 'empath', 'monk', 'mayor'].map((id) =>
					s.characters.get(id)!
				)
			}).steps;
			expect(steps.find((step) => step.id === 'leviathan')).toMatchObject({ afterDawn: true });
			expect(dayNumber(s.newDay().game)).toBe(3);
		});
	});
});
