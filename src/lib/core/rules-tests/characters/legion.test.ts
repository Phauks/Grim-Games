/**
 * Legion: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Legion
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Legion.
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
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { executionOutcomes, votersAnswer } from '#lib/core/rules/day/execution-outcome.ts';
import { nightKill } from '#lib/core/rules/night/night-kill.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargets } from '#lib/core/rules/reminders/reminder-targets.ts';

describe('Legion', () => {
	const character = committedCharacter('legion');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Legion');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'About To Die']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('legion')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'selection', name: 'bag-duplicate' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Legion#Examples)', () => {
		// Waits on the engine: no game end lets evil win once only one good player is alive.
		// Wiki (How to Run): "On the final day, if the players don’t execute, kill a good player
		// that night so that evil wins."
		it('Example 1: Two good players, one executed: evil wins', () => {
			// Wiki: "The only good players are the Fortune Teller and the Slayer. 6 Legion and the Slayer
			// vote to execute the Fortune Teller. They are executed, and evil wins."
			// Waits on the engine (M15l): no game end for evil when only one good player is alive (the Storyteller may declare it).
			const s = scenario([
				'fortuneteller',
				'legion',
				'legion',
				'legion',
				'slayer',
				'legion',
				'legion',
				'legion'
			])
				.newDay()
				.nominate(1, 'fortuneteller')
				.execute('fortuneteller');
			// A good player voted, so the execution stands; one good player is left alive.
			expect(s.game.seats[s.seat('fortuneteller')].dead).toBe(true);
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ winner: 'evil' }]);
		});
		it('Example 2: Zero tally spares one; another dies instead', () => {
			// Wiki: "4 players are alive. 3 Legion and no good players vote to execute Julian. Julian is
			// not executed. Alex, who has 2 votes, 1 of which is a good player, is executed instead. Evil
			// wins."
			// Julian is a Legion; Alex, the Chef, is the only good player alive.
			const s = scenario(['chef', 'legion', 'legion', 'legion', 'empath', 'monk'])
				.dies('empath', 'legion')
				.dies('monk', 'legion')
				.newDay()
				.nominate(2, 1)
				.nominate(3, 'chef');
			expect(s.game.today.entries.filter((e) => e.kind === 'nomination')).toHaveLength(2);
			// Only evil voted for Julian: Legion makes that execution fail. Alex is executed instead.
			const failed = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat(1),
				outcome: { kind: 'failed', characterId: 'legion' }
			}));
			expect(failed.game.seats[failed.seat(1)].dead).toBe(false);
			const end = failed.execute('chef');
			expect(end.game.seats[end.seat('chef')].dead).toBe(true);
			expect(gameEnds(end.game, end.characters)).toMatchObject([{ winner: 'evil' }]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Legion#How_to_Run)', () => {
		const cast = ['chef', 'legion', 'empath', 'legion', 'monk', 'legion', 'legion'];

		it('has the Demon Info step on the first night, and no Legion step of its own', () => {
			// Wiki: "During the first night, during the Demon Info step, let all Legion players make eye
			// contact."
			const data = committedGameData();
			const inPlay = cast.map((id) => data.byId.get(id)!);
			const { steps } = nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 7 });
			expect(steps.map((step) => step.id)).toContain('demoninfo');
			expect(steps.map((step) => step.id)).not.toContain('legion');
		});

		it('may kill one player on each night after the first', () => {
			// Wiki: "Each night except the first, you may decide that a player dies."
			const placeholders = placeholdersFor(character, 'other');
			const text = nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
			expect(text).toContain('[+Dead]');
			const s = scenario(cast).newDay().dusk();
			expect(nightKill(s.game, s.seat(1), 'legion', s.characters)).toEqual({
				max: 1,
				delayed: []
			});
		});

		it('offers to fail an execution only evil players voted for', () => {
			// Wiki: "When counting votes, count out loud, as normal. If the vote tally is enough to make
			// a player about to die but only evil players voted, declare that the vote tally is zero."
			const s = scenario(cast).newDay().nominate(1, 'chef');
			expect(executionOutcomes(s.game, s.seat('chef'), s.characters)).toEqual([
				{ kind: 'fails', characterId: 'legion', seatId: s.seat(1), works: true }
			]);
			expect(votersAnswer(s.game, 'only-evil-voted', [s.seat(1), s.seat(3)])).toBe(true);
			expect(votersAnswer(s.game, 'only-evil-voted', [s.seat(1), s.seat('empath')])).toBe(false);
		});

		it('lets About To Die mark any player for a secret execution', () => {
			// Wiki: "If the players try to force others to vote to “test whether the vote tally is zero”,
			// you may instead declare that a zero-tally vote is successful but secretly keep a record of
			// which player is really about to die by marking them with Legion’s ABOUT TO DIE reminder,
			// then execute them when nominations are over."
			const s = scenario(cast).newDay();
			const about = { characterId: 'legion', label: 'About To Die' };
			expect(reminderTargets(s.game, about, s.characters).every((t) => t.misses.length === 0)).toBe(
				true
			);
		});
	});
});
