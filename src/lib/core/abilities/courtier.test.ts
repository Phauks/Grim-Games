/**
 * Courtier: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Courtier
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Courtier.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { countdownMoves } from '#lib/core/rules/countdown.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

/** One night's countdown, as the Courtier's step does it: each token swapped for the next. */
function countDown(s: Scenario): Scenario {
	return s.do(
		...countdownMoves(s.game, 'courtier', s.characters).flatMap((m): Command[] => [
			{ type: 'RemoveReminder', reminderId: m.reminderId },
			...(m.to
				? [
						{
							type: 'AddReminder',
							seatId: m.seatId,
							reminder: { characterId: 'courtier', label: m.to }
						} satisfies Command
					]
				: [])
		])
	);
}

describe('Courtier', () => {
	const character = committedCharacter('courtier');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Courtier');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk 3', 'Drunk 2', 'Drunk 1', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('courtier')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Courtier#Examples)', () => {
		it('Example 1: Courtier drunks Shabaloth, which then cannot kill', () => {
			// The Courtier names the Shabaloth: its player is drunk for three nights and days, the
			// token counting down 3, 2, 1, then coming off, and the Shabaloth works again.
			let s = scenario(['courtier', 'chef', 'shabaloth', 'monk', 'poisoner']).reminder(
				'shabaloth',
				'courtier',
				'Drunk 3'
			);
			const labels: string[] = [];
			for (let night = 0; night < 3; night++) {
				expect(abilityState(s.game, s.seat('shabaloth'), s.characters).works).toBe(false);
				labels.push(s.game.seats[s.seat('shabaloth')].reminders.map((r) => r.label).join());
				s = countDown(s);
			}
			expect(labels).toEqual(['Drunk 3', 'Drunk 2', 'Drunk 1']);
			expect(s.game.seats[s.seat('shabaloth')].reminders).toEqual([]);
			expect(abilityState(s.game, s.seat('shabaloth'), s.characters).works).toBe(true);
		});
		it("Example 2: Drunk Courtier's ability does nothing", () => {
			// The Courtier's player is drunk when they choose, so nobody becomes drunk: the step
			// says their ability doesn't work. A Courtier poisoned after choosing sobers the player.
			const drunk = scenario(['courtier', 'chef', 'shabaloth', 'monk', 'poisoner']).drunk(
				'courtier'
			);
			expect(abilityState(drunk.game, drunk.seat('courtier'), drunk.characters).works).toBe(false);
			const poisoned = scenario(['courtier', 'chef', 'shabaloth', 'monk', 'poisoner'])
				.reminder('shabaloth', 'courtier', 'Drunk 3')
				.poisoned('courtier');
			expect(
				abilityState(poisoned.game, poisoned.seat('shabaloth'), poisoned.characters).works
			).toBe(true);
		});
		it('Example 3: Drunk Mastermind fails, so good wins', () => {
			// With the Mastermind drunk, executing the Demon ends the game at once: good wins.
			const s = scenario(['courtier', 'chef', 'empath', 'mastermind', 'po'])
				.reminder('mastermind', 'courtier', 'Drunk 2')
				.execute('po');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
		});
	});
});
