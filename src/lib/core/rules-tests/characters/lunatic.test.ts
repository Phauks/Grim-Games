/**
 * Lunatic: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lunatic
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lunatic.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { believedDemon, believesDemon, chosenLikeDemon } from '#lib/core/rules/night/evil-info.ts';
import { nightKiller } from '#lib/core/rules/night/night-killers.ts';
import { preventedDeaths } from '#lib/core/rules/day/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedNightOrder,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { stepInfoCards, stepInfoTokens } from '#lib/core/rules/night/info-token-characters.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup/setup-reminders.ts';

describe('Lunatic', () => {
	const character = committedCharacter('lunatic');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition bmr', () => {
			expect(character.name).toBe('Lunatic');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Chosen', 'Chosen', 'Chosen']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lunatic')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lunatic#Examples)', () => {
		it('Example 1: Lunatic as Shabaloth: targets never die', () => {
			// Wiki: "The Lunatic, thinking they are the Shabaloth, wakes each night to choose two
			// players. The chosen players do not die."
			const s = scenario(['lunatic', 'chef', 'empath', 'monk', 'poisoner', 'shabaloth'])
				.newDay()
				.reminder('chef', 'lunatic', 'Chosen')
				.reminder('empath', 'lunatic', 'Chosen');
			expect(believesDemon(s.game, s.seat('lunatic'), s.characters)).toBe(true);
			expect(believedDemon(s.game, s.seat('lunatic'), s.characters)).toBe('shabaloth');
			expect(chosenLikeDemon(s.game, s.seat('lunatic'), s.characters)).toEqual([
				s.seat('chef'),
				s.seat('empath')
			]);
			// The Lunatic's choice kills nobody.
			expect(nightKiller(s.game, 'lunatic', s.characters)).toBeUndefined();
			expect(preventedDeaths(s.game, s.characters)).toEqual([]);
		});
		it("Example 2: Real Zombuul mirrors the Lunatic's fake kills", () => {
			// Wiki: "The Lunatic, thinking they are the Zombuul, does not wake often at night. The real
			// Zombuul, who is pretending to be the Lunatic's Minion, often attacks the same players the
			// Lunatic chooses, to keep up the illusion that the Lunatic is the Demon."
			// The Storyteller sees whom the Lunatic chose, and the Zombuul may kill the same player.
			const s = scenario(['lunatic', 'chef', 'empath', 'monk', 'zombuul'])
				.newDay()
				.reminder('chef', 'lunatic', 'Chosen');
			expect(believedDemon(s.game, s.seat('lunatic'), s.characters)).toBe('zombuul');
			expect(chosenLikeDemon(s.game, s.seat('lunatic'), s.characters)).toEqual([s.seat('chef')]);
			const killed = s.reminder('chef', 'zombuul', 'Dead').dies('chef', 'zombuul');
			expect(killed.game.seats[killed.seat('chef')]).toMatchObject({
				dead: true,
				deathCause: 'zombuul'
			});
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Lunatic#How_to_Run)', () => {
		it('asks the Storyteller at setup which Demon the Lunatic thinks they are', () => {
			// Wiki: "While setting up the game, put the Lunatic and Demon tokens in the bag. Once all
			// tokens have been returned to you, swap the positions of the Lunatic and Demon tokens in
			// the Grimoire."
			const s = scenario(['lunatic', 'chef', 'empath', 'poisoner', 'shabaloth']);
			expect(setupPrep('lunatic', character.name, s.characters)).toHaveLength(1);
			expect(believesDemon(s.game, s.seat('lunatic'), s.characters)).toBe(true);
		});

		it('wakes the Lunatic first to be shown Minions and three bluffs as the Demon would be', () => {
			// Wiki: "During the first night, wake the Lunatic and act as if they are the Demon. Show
			// them the THESE ARE YOUR MINIONS info token and point to a number of players equaling the
			// number of Minions in play. (These can be any players, whether or not they are Minions.)
			// Show any three good character tokens as bluffs. (These can even be characters that are
			// in play.)"
			const tokens = stepInfoTokens(character, character.firstNightReminder).map((t) => t.id);
			expect(tokens).toContain('these-are-your-minions');
			expect(tokens).toContain('not-in-play');
		});

		it('then shows the real Demon This Player Is, with the Lunatic token', () => {
			// Wiki: "During the first night, wake the Demon. Show them the YOU ARE info token, then
			// their Demon token. (This tells them they are the real Demon.) Show them the THIS PLAYER IS
			// info token, then the Lunatic token, then point at the Lunatic player."
			// The real Demon drew their own token, so no You Are card is offered (Trevor, 2026-11-02).
			const cards = stepInfoCards(character, character.firstNightReminder).map((c) => c.token.id);
			expect(cards).toContain('this-player-is');
			expect(cards).not.toContain('you-are');
		});

		it("marks the Lunatic's choices Chosen, before the Demon's step each night", () => {
			// Wiki: "Each night, before the Demon wakes to attack, wake the Lunatic to act as if they
			// were that Demon. Put a CHOSEN reminder on each player they chose, then put them to
			// sleep. Wake the real Demon, point at the Lunatic, show the Lunatic token to the real
			// Demon, and point at the players that the Lunatic chose."
			const s = scenario(['lunatic', 'chef', 'empath', 'poisoner', 'shabaloth']).newDay();
			const chosen = { characterId: 'lunatic', label: 'Chosen' };
			for (const seat of ['lunatic', 'chef', 'shabaloth'] as const)
				expect(reminderTargetMisses(s.game, chosen, s.seat(seat), s.characters), seat).toEqual([]);
			const order = committedNightOrder('otherNight');
			for (const demon of ['zombuul', 'pukka', 'shabaloth', 'po'])
				expect(order.indexOf('lunatic'), demon).toBeLessThan(order.indexOf(demon));
			expect(character.otherNightReminder).toContain('Show the Lunatic token');
		});
	});
});
