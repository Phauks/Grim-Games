/**
 * Innkeeper: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Innkeeper
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Innkeeper.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { protection } from '#lib/core/rules/abilities/protection.ts';
import { survivesFirstDeath } from '#lib/core/rules/abilities/first-death.ts';
import { preventedDeaths } from '#lib/core/rules/day/prevented-deaths.ts';
import { scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';

describe('Innkeeper', () => {
	const character = committedCharacter('innkeeper');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Innkeeper');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Safe', 'Safe', 'Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('innkeeper')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Innkeeper#Examples)', () => {
		/** The Innkeeper protects two players tonight and makes `drunk` (one of them) drunk. */
		const inn = (cast: string[], safe: [SeatRef, SeatRef], drunk: SeatRef) =>
			scenario(cast)
				.newDay()
				.reminder(safe[0], 'innkeeper', 'Safe')
				.reminder(safe[1], 'innkeeper', 'Safe')
				.reminder(drunk, 'innkeeper', 'Drunk');

		it('Example 1: Drunk Fool dies at execution without acting', () => {
			// Wiki: "The Innkeeper protects the Fool and the Chambermaid. The Storyteller chooses that
			// the Fool becomes drunk. Tomorrow, when the Fool is executed, they die, even though they
			// hadn’t used their ability yet."
			const s = inn(
				['innkeeper', 'fool', 'chambermaid', 'chef', 'imp'],
				['fool', 'chambermaid'],
				'fool'
			).newDay();
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'execution', s.characters)).toBeUndefined();
			const executed = s.execute('fool');
			expect(executed.game.seats[executed.seat('fool')]).toMatchObject({
				dead: true,
				deathCause: 'execution'
			});
		});
		it("Example 2: Drunk Assassin's kill attempt fizzles", () => {
			// Wiki: "The Innkeeper protects the Assassin and the Po. The Storyteller chooses that the
			// Assassin becomes drunk. Later that night, the Assassin uses their ability, but nothing
			// happens."
			const s = inn(
				['innkeeper', 'chef', 'empath', 'assassin', 'po'],
				['assassin', 'po'],
				'assassin'
			).reminder('chef', 'assassin', 'Dead');
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					killer: 'assassin',
					seatId: s.seat('chef'),
					because: [{ kind: 'killer-impaired', seatId: s.seat('assassin') }]
				}
			]);
		});
		it('Example 3: Self-protection backfires; Demon kills the Pacifist', () => {
			// Wiki: "The Innkeeper protects themself and the Pacifist. The Storyteller chooses that the
			// Innkeeper becomes drunk. The Pacifist is attacked by the Demon tonight and dies."
			const s = inn(
				['innkeeper', 'pacifist', 'chef', 'empath', 'imp'],
				['innkeeper', 'pacifist'],
				'innkeeper'
			).reminder('pacifist', 'imp', 'Dead');
			expect(protection(s.game, s.seat('pacifist'), s.characters, 'demon')).toBeUndefined();
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{ seatId: s.seat('pacifist'), because: [] }
			]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Innkeeper#How_to_Run)', () => {
		const cast = ['innkeeper', 'chef', 'empath', 'monk', 'godfather', 'imp'];

		it('marks two players Safe and one of those two Drunk', () => {
			// Wiki: "Each night except the first, wake the Innkeeper. They point at any two players.
			// Put the Innkeeper to sleep. Mark the two chosen players with SAFE reminders. One of the
			// chosen players becomes drunk—mark them with the DRUNK reminder."
			const s = scenario(cast).newDay();
			const safe = { characterId: 'innkeeper', label: 'Safe' };
			const drunk = { characterId: 'innkeeper', label: 'Drunk' };
			for (const seat of ['innkeeper', 'chef', 'imp'] as const)
				expect(reminderTargetMisses(s.game, safe, s.seat(seat), s.characters), seat).toEqual([]);
			const marked = s
				.reminder('chef', 'innkeeper', 'Safe')
				.reminder('empath', 'innkeeper', 'Safe');
			expect(
				reminderTargetMisses(marked.game, drunk, marked.seat('chef'), marked.characters)
			).toEqual([]);
			expect(
				reminderTargetMisses(marked.game, drunk, marked.seat('monk'), marked.characters)
			).toEqual(['with-label']);
			const chef = marked.reminder('chef', 'innkeeper', 'Drunk');
			expect(abilityState(chef.game, chef.seat('chef'), chef.characters).impairments).toMatchObject(
				[{ reason: 'drunk', source: { characterId: 'innkeeper' } }]
			);
		});

		it('keeps a Safe player from dying tonight, by the Demon or by another ability', () => {
			// Wiki: "The players marked SAFE cannot die tonight."
			const s = scenario(cast).newDay().reminder('chef', 'innkeeper', 'Safe');
			for (const by of ['demon', 'other'] as const)
				expect(protection(s.game, s.seat('chef'), s.characters, by), by).toMatchObject({
					characterId: 'innkeeper'
				});
			expect(protection(s.game, s.seat('empath'), s.characters, 'demon')).toBeUndefined();
		});

		it('takes the Safe reminders off at dawn', () => {
			// Wiki: "At dawn, remove the SAFE reminders."
			const s = scenario(cast).newDay().reminder('chef', 'innkeeper', 'Safe').newDay();
			expect(s.game.seats[s.seat('chef')].reminders).toEqual([]);
		});

		it('takes the Drunk reminder off at dusk', () => {
			// Wiki: "At dusk, remove the DRUNK reminder."
			const s = scenario(cast).newDay().reminder('chef', 'innkeeper', 'Drunk').newDay().dusk();
			expect(s.game.seats[s.seat('chef')].reminders).toEqual([]);
		});
	});
});
