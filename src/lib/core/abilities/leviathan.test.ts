/**
 * Leviathan: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Leviathan
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Leviathan.
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
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { nightTextPlain, nightTextSegments, placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';

describe('Leviathan', () => {
	const character = committedCharacter('leviathan');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Leviathan');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([
				'Day 1',
				'Day 2',
				'Day 3',
				'Day 4',
				'Day 5',
				'Good Player Executed'
			]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('leviathan')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Leviathan#Examples)', () => {
		it('Example 1: Two good players executed early, so evil wins', () => {
			// Wiki: "On the first day, the Monk nominates the Virgin, and is executed. On the second day,
			// the Courtier is executed. Evil wins."
			const s = scenario(['chef', 'empath', 'monk', 'mayor', 'baron', 'leviathan'])
				.newDay()
				.execute('chef')
				.newDay()
				.execute('empath');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'executions-of-alignment', winner: 'evil' }
			]);
		});
		it('Example 2: Two evil executed, then one good', () => {
			// Wiki: "On the second day, the Scarlet Woman is executed. On the third day, the Poisoner is
			// executed. On the fifth day, the Soldier is executed. Evil wins."
			// One good player executed is not enough; the Leviathan is alive at the end of day 5.
			const s = scenario([
				'leviathan',
				'scarletwoman',
				'poisoner',
				'soldier',
				'chef',
				'empath',
				'monk',
				'mayor'
			])
				.newDay()
				.newDay()
				.execute('scarletwoman')
				.newDay()
				.execute('poisoner')
				.newDay()
				.newDay()
				.execute('soldier');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'survives-day', day: 5, winner: 'evil' }
			]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Leviathan#How_to_Run)', () => {
		const cast = ['leviathan', 'baron', 'chef', 'empath', 'monk', 'mayor', 'soldier'];

		it('announces the Leviathan and places Day 1 just after the first dawn', () => {
			// Wiki: "Immediately after dawn on the first day, declare that the Leviathan is in play.
			// Mark the Leviathan with the DAY 1 reminder."
			const s = scenario(cast);
			expect(setupPrep('leviathan', character.name, s.characters)).toMatchObject([
				{ tokens: ['Day 1'], target: 'the Leviathan' }
			]);
			const data = committedGameData();
			const inPlay = cast.map((id) => data.byId.get(id)!);
			const { steps } = nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 7 });
			expect(steps.find((step) => step.id === 'leviathan')?.afterDawn).toBe(true);
		});

		it('moves the Leviathan to the next day token at the start of each day', () => {
			// Wiki: "At the beginning of each following day, mark the Leviathan with DAY 2, then DAY 3,
			// then DAY 4, then DAY 5 reminders."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			for (const day of ['Day 2', 'Day 3', 'Day 4', 'Day 5']) expect(text).toContain(day);
			const s = scenario(cast);
			const day2 = { characterId: 'leviathan', label: 'Day 2' };
			expect(reminderTargetMisses(s.game, day2, s.seat('leviathan'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, day2, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('gives evil the win when day 5 ends, not before', () => {
			// Wiki: "If a day ends and the Leviathan is marked with the DAY 5 reminder, declare that evil
			// wins."
			const day4 = scenario(cast).newDay().newDay().newDay().newDay();
			expect(gameEnds(day4.game, day4.characters, { dayEnded: true })).toEqual([]);
			const day5 = day4.newDay();
			expect(gameEnds(day5.game, day5.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'survives-day', day: 5, winner: 'evil' }
			]);
		});

		it('puts Good Player Executed only on a good player', () => {
			// Wiki: "If a good player is executed, mark them with the GOOD PLAYER EXECUTED reminder."
			const s = scenario(cast).newDay().execute('chef');
			const marked = { characterId: 'leviathan', label: 'Good Player Executed' };
			expect(reminderTargetMisses(s.game, marked, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, marked, s.seat('baron'), s.characters)).toEqual([
				'alignment'
			]);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
	});

	describe('the execution marks the first good player executed (M70)', () => {
		const cast = ['chef', 'empath', 'monk', 'mayor', 'baron', 'leviathan'];
		const marked = (s: ReturnType<typeof scenario>) =>
			s.game.seating.filter((id) =>
				s.game.seats[id].reminders.some(
					(r) => r.characterId === 'leviathan' && r.label === 'Good Player Executed'
				)
			);

		it('marks an executed good player Good Player Executed, and only the first', () => {
			// Wiki: "If a good player is executed, mark them with the GOOD PLAYER EXECUTED reminder."
			const first = scenario(cast).execute('chef');
			expect(marked(first)).toEqual([first.seat('chef')]);
			const second = first.newDay().execute('empath');
			expect(marked(second)).toEqual([second.seat('chef')]);
		});

		it('marks no evil player', () => {
			// Wiki: "If a good player is executed, mark them with the GOOD PLAYER EXECUTED reminder."
			expect(marked(scenario(cast).execute('baron'))).toEqual([]);
		});
	});
});
