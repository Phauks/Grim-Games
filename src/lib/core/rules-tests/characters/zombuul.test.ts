/**
 * Zombuul: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Zombuul
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Zombuul.
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
	nightSheetPresence,
	committedCharacters
} from '#lib/core/testing/committed-data.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { livesWhileDead } from '#lib/core/rules/game-end/game-end-helpers.ts';
import { diedSinceNewDay } from '#lib/core/rules/night/night-numbers.ts';
import { wakeConditionMet } from '#lib/core/rules/night/wakes-when.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightKill } from '#lib/core/rules/night/night-kill.ts';
import { reminderPrompt } from '#lib/core/rules/reminders/reminder-prompts.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';

describe('Zombuul', () => {
	const character = committedCharacter('zombuul');

	describe('data (roles.json)', () => {
		it('is a Demon from edition bmr', () => {
			expect(character.name).toBe('Zombuul');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Died Today', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('zombuul')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Zombuul#Examples)', () => {
		it('Example 1: Executed Zombuul appears dead', () => {
			// Wiki: "The Zombuul is executed and appears to die. They cannot attack tonight. A few days
			// later, only two players appear alive on the Town Square. The good team is fairly certain that
			// one of the dead players is the Zombuul, and the game continues until one more player dies."
			const executed = scenario(['zombuul', 'chef', 'empath', 'monk', 'poisoner']).execute(
				'zombuul'
			);
			expect(livesWhileDead(executed.game, executed.seat('zombuul'), executed.characters)).toBe(
				true
			);
			const later = executed.newDay().dies('chef').newDay().dies('empath');
			expect(gameEnds(later.game, later.characters)).toEqual([]);
			// Waits on the engine (M15k): the Zombuul's step has no "only if nobody died today" condition.
			expect(
				wakeConditionMet(
					executed.game,
					'zombuul',
					executed.seat('zombuul'),
					executed.characters,
					new Set()
				)
			).toBe(false);
		});

		it('Example 2: Quiet day brings attack; next night skipped', () => {
			// Wiki: "Nobody died today. That night, the Zombuul attacks. The next day, the Tinker dies. That
			// night, the Zombuul does not wake."
			const quiet = scenario(['zombuul', 'tinker', 'chef', 'empath', 'poisoner']).newDay();
			expect(
				wakeConditionMet(quiet.game, 'zombuul', quiet.seat('zombuul'), quiet.characters, new Set())
			).toBe(true);
			const tinkerDied = quiet.dies('chef', 'zombuul').newDay().dies('tinker', 'tinker');
			// The night order passes who died since the New day, from the log.
			const died = diedSinceNewDay(tinkerDied.session.log.entries.flatMap((e) => e.events));
			expect(
				wakeConditionMet(
					tinkerDied.game,
					'zombuul',
					tinkerDied.seat('zombuul'),
					tinkerDied.characters,
					died
				)
			).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Zombuul#How_to_Run)', () => {
		const cast = ['zombuul', 'chef', 'empath', 'monk', 'assassin'];

		it('lives on, registering as dead, the first time it would die', () => {
			// Wiki: "The first time the Zombuul would die, they remain alive. Declare that they died,
			// but do not add a shroud to the Zombuul. (Flip the life token on the Town Square, as
			// normal.) From now on, the Zombuul registers as dead."
			const s = scenario(cast).newDay().dies('zombuul', 'assassin');
			expect(s.game.seats[s.seat('zombuul')].dead).toBe(true);
			expect(livesWhileDead(s.game, s.seat('zombuul'), s.characters)).toBe(true);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});

		it('takes Died Today on any player who died today, the Zombuul included', () => {
			// Wiki: "Each day, if a player dies, mark them with the DIED TODAY reminder. (If the Zombuul
			// “dies” by execution, they register as dead, so mark the Zombuul with the DIED TODAY
			// reminder.)"
			const s = scenario(cast).newDay().execute('zombuul');
			const diedToday = { characterId: 'zombuul', label: 'Died Today' };
			expect(reminderTargetMisses(s.game, diedToday, s.seat('zombuul'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, diedToday, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderPrompt('Died Today', 'zombuul', committedCharacters())).toBe('markDead');
		});

		it('does not wake while any player is marked Died Today', () => {
			// Wiki: "Each night except the first, if any player is marked DIED TODAY, do not wake the
			// Zombuul."
			const s = scenario(cast).newDay().reminder('chef', 'zombuul', 'Died Today');
			expect(wakeConditionMet(s.game, 'zombuul', s.seat('zombuul'), s.characters, new Set())).toBe(
				false
			);
		});

		it('wakes on a night after nobody died, to choose one player who dies', () => {
			// Wiki: "Each night except the first, if no player is marked DIED TODAY, wake the Zombuul.
			// They point at any player. Put the Zombuul to sleep. The chosen player dies—mark them with
			// the DEAD reminder."
			const s = scenario(cast).newDay();
			expect(wakeConditionMet(s.game, 'zombuul', s.seat('zombuul'), s.characters, new Set())).toBe(
				true
			);
			expect(nightKill(s.game, s.seat('zombuul'), 'zombuul', s.characters)?.max).toBe(1);
			const dead = { characterId: 'zombuul', label: 'Dead' };
			for (const seat of ['chef', 'assassin'] as const)
				expect(reminderTargetMisses(s.game, dead, s.seat(seat), s.characters), seat).toEqual([]);
		});
	});

	describe('the execution marks the executed player Died Today (M70)', () => {
		const cast = ['zombuul', 'chef', 'empath', 'monk', 'poisoner'];
		const diedToday = (s: ReturnType<typeof scenario>, ref: string) =>
			s.game.seats[s.seat(ref)].reminders.filter(
				(r) => r.characterId === 'zombuul' && r.label === 'Died Today'
			);

		it('marks whoever dies by execution', () => {
			// Wiki: "Each day, if a player dies, mark them with the DIED TODAY reminder."
			expect(diedToday(scenario(cast).newDay().execute('chef'), 'chef')).toHaveLength(1);
		});

		it('marks whoever dies another way during the day', () => {
			// Wiki: "Each day, if a player dies, mark them with the DIED TODAY reminder."
			const s = scenario(cast)
				.newDay()
				.do((at) => ({
					type: 'SetDead',
					seatId: at.seat('chef'),
					dead: true,
					cause: 'other',
					day: true
				}));
			expect(diedToday(s, 'chef')).toHaveLength(1);
		});

		it('marks the Zombuul when the Zombuul is executed', () => {
			// Wiki: "If the Zombuul “dies” by execution, they register as dead, so mark the Zombuul with
			// the DIED TODAY reminder."
			expect(diedToday(scenario(cast).newDay().execute('zombuul'), 'zombuul')).toHaveLength(1);
		});
	});
});
