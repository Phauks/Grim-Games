/**
 * Godfather: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Godfather
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Godfather.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';

describe('Godfather', () => {
	const character = committedCharacter('godfather');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe('Godfather');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Died Today', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('godfather')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Godfather#Examples)', () => {
		it('Example 1: Godfather bluffs Tinker while Lunatic is executed', () => {
			// Wiki: "The Godfather learns that the Lunatic and the Moonchild are in play, so the
			// Godfather bluffs as the Tinker. During the third day, the Lunatic dies by execution.
			// That night, the Demon kills the Minstrel, and the Godfather kills the Pacifist."
			const cast = ['godfather', 'lunatic', 'moonchild', 'minstrel', 'pacifist', 'chef', 'imp'];
			const s = scenario(cast);
			expect(
				nightAnswer(s.game, s.seat('godfather'), 'godfather', s.characters, undefined, 'first')
			).toMatchObject({ kind: 'characters', value: ['lunatic', 'moonchild'] });
			const day3 = s.newDay().newDay().newDay().execute('lunatic');
			expect(
				nightAnswer(
					day3.game,
					day3.seat('godfather'),
					'godfather',
					day3.characters,
					undefined,
					'other'
				)
			).toMatchObject({ kind: 'yes-no', value: true, because: [day3.seat('lunatic')] });
		});
		it('Example 2: Protected Tinker dies later; Godfather sacrifices themself', () => {
			// Wiki: "The Tinker is executed but remains alive, because they were protected by the
			// Devil's Advocate. The Godfather does not act that night. The next day, the Tinker dies
			// due to their own ability. That night, the Demon kills a player, and the Godfather kills
			// themself to appear like a good player."
			const cast = ['godfather', 'tinker', 'devilsadvocate', 'chef', 'empath', 'imp'];
			const saved = scenario(cast)
				.reminder('tinker', 'devilsadvocate', 'Survives Execution')
				.newDay()
				.execute('tinker');
			expect(saved.game.seats[saved.seat('tinker')].dead).toBe(false);
			expect(
				nightAnswer(
					saved.game,
					saved.seat('godfather'),
					'godfather',
					saved.characters,
					undefined,
					'other'
				)
			).toMatchObject({ kind: 'none' });
			const died = saved.newDay().dies('tinker', 'tinker');
			expect(
				nightAnswer(
					died.game,
					died.seat('godfather'),
					'godfather',
					died.characters,
					{ died: [died.seat('tinker')] },
					'other'
				)
			).toMatchObject({ kind: 'yes-no', value: true, because: [died.seat('tinker')] });
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Godfather#How_to_Run)', () => {
		it('allows one Outsider fewer or one more than the setup sheet', () => {
			// Wiki: "While setting up the game, before putting the character tokens in the bag, either
			// remove one Townsfolk and add one Outsider or remove one Outsider and add one Townsfolk."
			const data = committedGameData();
			const ids = ['chef', 'empath', 'monk', 'slayer', 'soldier', 'butler', 'godfather', 'imp'];
			const result = analyseSetup({ players: 8, inPlay: ids.map((id) => data.byId.get(id)!) });
			expect(result.base.outsider).toBe(1);
			expect(result.expected.outsider).toEqual([0, 2]);
			expect(result.expected.townsfolk).toEqual([4, 6]);
		});

		it('is shown no Outsiders on the first night when none are in play', () => {
			// Wiki: "During the first night, wake the Godfather. Show them the character tokens of all
			// Outsiders in play. Put the Godfather to sleep."
			const s = scenario(['godfather', 'chef', 'empath', 'monk', 'imp']);
			expect(
				nightAnswer(s.game, s.seat('godfather'), 'godfather', s.characters, undefined, 'first')
			).toMatchObject({ kind: 'characters', value: [] });
		});

		it('puts Died Today only on a dead Outsider, and Dead on any player', () => {
			// Wiki: "If an Outsider dies during the day, mark them with the DIED TODAY reminder. That
			// night, wake the Godfather. They point at any player. Put the Godfather to sleep. The
			// chosen player dies—mark them with the DEAD reminder."
			const s = scenario(['godfather', 'tinker', 'goon', 'chef', 'imp'])
				.newDay()
				.execute('tinker')
				.dies('chef', 'demon');
			const diedToday = { characterId: 'godfather', label: 'Died Today' };
			const misses = (seat: 'tinker' | 'goon' | 'chef') =>
				reminderTargetMisses(s.game, diedToday, s.seat(seat), s.characters);
			expect(misses('tinker')).toEqual([]);
			expect(misses('goon')).toEqual(['life']);
			expect(misses('chef')).toEqual(['type']);
			const dead = { characterId: 'godfather', label: 'Dead' };
			for (const seat of ['godfather', 'goon', 'imp'] as const)
				expect(reminderTargetMisses(s.game, dead, s.seat(seat), s.characters), seat).toEqual([]);
		});
	});

	describe('the execution marks an Outsider Died Today (M70)', () => {
		const cast = ['godfather', 'saint', 'chef', 'empath', 'imp'];
		const diedToday = (s: ReturnType<typeof scenario>, ref: string) =>
			s.game.seats[s.seat(ref)].reminders.filter(
				(r) => r.characterId === 'godfather' && r.label === 'Died Today'
			);

		it('marks an executed Outsider, and nobody else', () => {
			// Wiki: "If an Outsider dies during the day, mark them with the DIED TODAY reminder."
			expect(diedToday(scenario(cast).execute('saint'), 'saint')).toHaveLength(1);
			expect(diedToday(scenario(cast).execute('chef'), 'chef')).toEqual([]);
		});
	});
});
