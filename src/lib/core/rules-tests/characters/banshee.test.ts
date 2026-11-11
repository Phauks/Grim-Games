/**
 * Banshee: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Banshee
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Banshee.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { deathReminder } from '#lib/core/rules/abilities/first-death.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { afterDeath, nominationsPerDay } from '#lib/core/rules/day/nominations.ts';
import {
	dayReminders,
	dayStateFromGame,
	renderReminder
} from '#lib/core/rules/day/day-reminders.ts';
import { onDeathApplies, onDeathTrigger } from '#lib/core/rules/night/night-killers.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { voteWorth } from '#lib/core/rules/day/vote-weights.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Banshee', () => {
	const character = committedCharacter('banshee');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Banshee');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Has Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('banshee')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Banshee#Examples)', () => {
		it('Example 1: Demon kill grants extra nominations and votes', () => {
			// Wiki: "The Kazali kills the Banshee. All players learn that the Banshee has died. Tomorrow, the
			// Banshee nominates the Village Idiot and votes twice, then nominates the Fearmonger and votes
			// twice, then votes twice when the Shugenja is nominated. The next day, the Banshee doesn’t
			// nominate at all, but votes twice for the Kazali."
			const s = scenario(['banshee', 'villageidiot', 'fearmonger', 'shugenja', 'kazali', 'chef'])
				.dies('banshee', 'kazali')
				.newDay();
			expect(afterDeath(s.game, s.seat('banshee'), s.characters)).toMatchObject({
				nominations: 2,
				votes: 2
			});
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(2);
			const next = s.nominate('banshee', 'villageidiot').nominate('banshee', 'fearmonger').newDay();
			expect(nominationsPerDay(next.game, next.seat('banshee'), next.characters)).toBe(2);
		});

		it('Example 2: Poisoned Banshee killed; no power gained', () => {
			// Wiki: "The Banshee is poisoned. The Ojo kills the Banshee. Nobody learns that the Banshee has
			// died, and for the rest of the game, the Banshee may not nominate, and has just one vote."
			// The death records that the Banshee was poisoned (impairedAtDeath), so afterDeath gives nothing.
			const s = scenario(['banshee', 'poisoner', 'ojo', 'chef', 'empath'])
				.poisoned('banshee')
				.dies('banshee', 'ojo')
				.newDay();
			expect(afterDeath(s.game, s.seat('banshee'), s.characters)).toBeUndefined();
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(0);
		});

		it('Example 3: Lycanthrope kill grants no Banshee power', () => {
			// Wiki: "The Lycanthrope kills the Banshee. The Banshee does not gain their additional powers and
			// is not announced."
			const s = scenario(['banshee', 'lycanthrope', 'kazali', 'chef', 'empath']).dies(
				'banshee',
				'lycanthrope'
			);
			expect(afterDeath(s.game, s.seat('banshee'), s.characters)).toBeUndefined();
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(0);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Banshee#How_to_Run)', () => {
		it('marking the player dead asks to place Has Ability on them', () => {
			// Wiki: "If the Banshee is killed by the Demon, place the HAS ABILITY reminder token next to the Banshee"
			const s = scenario(['banshee', 'chef', 'empath', 'imp', 'poisoner']);
			for (const cause of ['imp'] as const) {
				const dead = s.dies('banshee', cause);
				expect(deathReminder(dead.game, dead.seat('banshee'), cause, dead.characters)).toEqual({
					characterId: 'banshee',
					label: 'Has Ability'
				});
			}
			// Wiki: "If the Banshee is killed by the Demon but does not have their ability at that time or is
			// killed by a non-Demon ability, then do not tell the group that the Banshee ability has been
			// triggered."
			for (const cause of ['execution', 'poisoner'] as const) {
				const dead = s.dies('banshee', cause);
				expect(
					deathReminder(dead.game, dead.seat('banshee'), cause, dead.characters)
				).toBeUndefined();
			}
			const poisoned = s.poisoned('banshee').dies('banshee', 'imp');
			expect(
				deathReminder(poisoned.game, poisoned.seat('banshee'), 'imp', poisoned.characters)
			).toBeUndefined();
		});

		const cast = ['banshee', 'chef', 'imp', 'monk', 'poisoner'];
		const linesOf = (at: Scenario) =>
			dayReminders(
				dayStateFromGame(at.game, (id) => at.characters.get(id), undefined, at.characters)
			).groups.flatMap((g) =>
				g.reminders
					.filter((r) => r.characterId === 'banshee')
					.map((r) => renderReminder(r.segments))
			);

		it('is set off by a Demon kill, not by an execution', () => {
			// Wiki: "If the Banshee is killed by the Demon, place the HAS ABILITY reminder token next to
			// the Banshee and say “The Banshee has awoken” or something similarly dramatic."
			const { characters } = scenario(cast);
			const trigger = onDeathTrigger('banshee', characters)!;
			expect(onDeathApplies(trigger, 'imp', characters)).toBe(true);
			expect(onDeathApplies(trigger, 'execution', characters)).toBe(false);
		});

		it('the Has Ability reminder goes on the dead Banshee only', () => {
			// Wiki: "If the Banshee is killed by the Demon, place the HAS ABILITY reminder token next to
			// the Banshee and say “The Banshee has awoken” or something similarly dramatic."
			const alive = scenario(cast);
			const token = { characterId: 'banshee', label: 'Has Ability' };
			expect(
				reminderTargetMisses(alive.game, token, alive.seat('banshee'), alive.characters)
			).toEqual(['life']);
			const killed = alive.dies('banshee', 'imp');
			expect(
				reminderTargetMisses(killed.game, token, killed.seat('banshee'), killed.characters)
			).toEqual([]);
			expect(
				reminderTargetMisses(killed.game, token, killed.seat('chef'), killed.characters)
			).toContain('not-self');
		});

		it("counts the Demon-killed Banshee's vote twice", () => {
			// Wiki: "The Banshee may nominate twice per day, but it is the player’s responsibility to
			// remember how many times they have nominated. The Banshee may raise two hands when voting.
			// When counting the votes, count each hand as a vote."
			const s = scenario(cast).dies('banshee', 'imp').newDay();
			expect(voteWorth(s.game, s.seat('banshee'), s.characters)).toBe(2);
			expect(linesOf(s)).toEqual(['[banshee · Ana] may nominate and vote twice']);
		});

		it('an executed Banshee votes once, and nothing is announced', () => {
			// Wiki: "If the Banshee is killed by the Demon but does not have their ability at that time
			// or is killed by a non-Demon ability, then do not tell the group that the Banshee ability
			// has been triggered. The Banshee may not nominate, and needs a vote token to vote, like a
			// regular dead player."
			const s = scenario(cast).dies('banshee', 'execution').newDay();
			expect(voteWorth(s.game, s.seat('banshee'), s.characters)).toBe(1);
			expect(nominationsPerDay(s.game, s.seat('banshee'), s.characters)).toBe(0);
			expect(linesOf(s)).toEqual([]);
		});
	});
});
