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
import { stepInfoCards } from '#lib/core/rules/info-token-characters.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Summoner#How_to_Run)', () => {
		const cast = ['summoner', 'snitch', 'chef', 'empath', 'monk', 'mayor'];

		it('deals no Demon, a Townsfolk in its place', () => {
			// Wiki: "During the setup phase, remove the Demon and add a Townsfolk."
			expect(setupModifierFor(character)).toMatchObject({
				ops: [{ kind: 'set', type: 'demon', values: [0] }],
				notes: ['Put a Townsfolk in the bag instead of the Demon.']
			});
		});

		it('counts the nights with Night 1, Night 2 and Night 3 on the Summoner', () => {
			// Wiki: "When preparing the first night, put the Summoner’s NIGHT 1 reminder by the
			// Summoner. When preparing the second night, put the Summoner’s NIGHT 2 reminder by the
			// Summoner. When preparing the third night, put the Summoner’s NIGHT 3 reminder by the
			// Summoner."
			expect(setupPrep('summoner', 'Summoner')[0]).toMatchObject({
				tokens: ['Night 1'],
				target: 'the Summoner'
			});
			const s = scenario(cast);
			for (const label of ['Night 1', 'Night 2', 'Night 3']) {
				const token = { characterId: 'summoner', label };
				expect(reminderTargetMisses(s.game, token, s.seat('summoner'), s.characters)).toEqual([]);
				expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toContain(
					'not-self'
				);
			}
		});

		it('gives the Summoner the 3 bluffs on the first night', () => {
			// Wiki: "During the first night, show the Summoner 3 not-in-play characters as bluffs."
			expect(setupPrep('summoner', 'Summoner')[1]).toMatchObject({
				text: 'Choose 3 not-in-play good characters as the Summoner’s bluffs'
			});
			expect(rulesOf('summoner')?.evilInfo?.notes?.demoninfo).toBe(
				'there is no Demon yet; the Summoner gets the bluffs.'
			);
		});

		it('makes an evil Demon only on the night the Summoner has Night 3', () => {
			// Wiki: "During the night, if the Summoner has a NIGHT 3 reminder, wake the Summoner. They
			// point at a player, and to a Demon icon on the character sheet."
			const night2 = scenario(cast).newDay().reminder('summoner', 'summoner', 'Night 2');
			expect(characterChanger(night2.game, 'summoner', night2.characters)).toBeUndefined();
			expect(rulesOf('summoner')?.changesCharacter).toMatchObject({
				types: ['demon'],
				alignment: 'evil',
				token: 'Night 3'
			});
		});

		it('shows the chosen player the Demon they became', () => {
			// Wiki: "Wake the chosen player. Show the YOU ARE info token, then the Demon token. Show the
			// YOU ARE info token, then give a thumbs down. Replace their character token with the Demon
			// token and put the new Demon to sleep."
			const cards = stepInfoCards(character, character.otherNightReminder, {
				changed: ['lleech']
			});
			expect(cards.find((card) => card.token.id === 'you-are')?.filled?.characterIds).toEqual([
				'lleech'
			]);
		});
	});
});
