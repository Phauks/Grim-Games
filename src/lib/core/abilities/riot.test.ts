/**
 * Riot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Riot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Riot.
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
import { mayNominate } from '#lib/core/rules/nominations.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { filledInfoToken } from '#lib/core/rules/info-token-characters.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Riot', () => {
	const character = committedCharacter('riot');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Riot');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Day 1', 'Day 2', 'Day 3']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('riot')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Riot#Examples)', () => {
		it('Example 1: Chain of nominations kills all Riot; good wins', () => {
			// Wiki: "Alex nominates Lewis. Lewis dies and nominates Ben. Ben dies and nominates
			// Marianna. Marianna dies and nominates Lachlan. Lachlan dies. All Riot players are dead.
			// Good wins."
			// Day 3: the Minions are all Riot now, so Lewis, Ben, Marianna and Lachlan are the Riot.
			const s = scenario(['chef', 'riot', 'riot', 'riot', 'riot', 'empath', 'monk'])
				.newDay()
				.newDay()
				.reminder(1, 'riot', 'Day 3');
			const [lewis, ben, marianna, lachlan] = [1, 2, 3, 4];
			const nominee = (at: typeof s, by: number, riot: number) =>
				at.nominate(by, riot).dies(riot, 'riot');
			const first = nominee(s, 0, lewis);
			const end = nominee(nominee(nominee(first, lewis, ben), ben, marianna), marianna, lachlan);
			expect(suggestedWinner(gameEnds(end.game, end.characters))).toBe('good');
			expect(gameEnds(end.game, end.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
			// A Riot nominee who dies nominates straight away, once.
			expect(mayNominate(first.game, first.seat(lewis), first.characters)).toBe(true);
			const second = nominee(first, lewis, ben);
			expect(mayNominate(second.game, second.seat(lewis), second.characters)).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Riot#How_to_Run)', () => {
		const cast = ['chef', 'riot', 'poisoner', 'empath', 'monk'];

		it('counts the days with Day 1, Day 2 and Day 3 on the Riot', () => {
			// Wiki: "On the 1st day, add the DAY 1 reminder to the Grimoire. On the 2nd day, add the DAY
			// 2 reminder to the Grimoire. On the 3rd day, add the DAY 3 reminder to the Grimoire."
			expect(setupPrep('riot', 'Riot')).toEqual([
				expect.objectContaining({ tokens: ['Day 1'], target: 'the Riot' })
			]);
			const s = scenario(cast);
			for (const label of ['Day 1', 'Day 2', 'Day 3']) {
				const token = { characterId: 'riot', label };
				expect(reminderTargetMisses(s.game, token, s.seat('riot'), s.characters)).toEqual([]);
				expect(reminderTargetMisses(s.game, token, s.seat('chef'), s.characters)).toContain(
					'not-self'
				);
			}
		});

		it('shows each Minion that they are the Riot on the 3rd night', () => {
			// Wiki: "On the 3rd night, wake each Minion. Show the YOU ARE info token, then the Riot
			// token, then put each Minion to sleep."
			expect(filledInfoToken(character, 'you-are', 1)?.characterIds).toEqual(['riot']);
		});

		it('lets a nominee who died nominate again only on the 3rd day', () => {
			// Wiki: "During the 3rd day, each time a player is nominated, they die. Declare that they
			// are dead, and add a shroud immediately. Tell them to nominate again"
			const before = scenario(cast).nominate('chef', 'empath').dies('empath', 'riot');
			expect(mayNominate(before.game, before.seat('empath'), before.characters)).toBe(false);
			const day3 = scenario(cast)
				.newDay()
				.newDay()
				.reminder('riot', 'riot', 'Day 3')
				.nominate('chef', 'empath');
			const causes = validDeathCauses(day3.game, day3.seat('empath'), day3.characters, {
				day: true
			});
			expect(causes).toContainEqual({ cause: 'demon', kind: 'general', flags: [] });
			const died = day3.dies('empath', 'riot');
			expect(mayNominate(died.game, died.seat('empath'), died.characters)).toBe(true);
		});

		it('ends the game for evil once just 2 players are alive', () => {
			// Wiki: "After they nominate, repeat this process until all Riot are dead, or just 2 players
			// are alive. Declare which team has won."
			const s = scenario(['chef', 'riot', 'riot', 'empath', 'monk'])
				.newDay()
				.newDay()
				.reminder(1, 'riot', 'Day 3')
				.dies('chef', 'riot')
				.dies('empath', 'riot')
				.dies('monk', 'riot');
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ rule: 'two-alive', winner: 'evil' }]);
		});
	});
});
