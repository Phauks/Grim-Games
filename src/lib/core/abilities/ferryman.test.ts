/**
 * Ferryman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Ferryman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Ferryman.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { ghostVotesLeft } from '#lib/core/rules/voting.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Ferryman', () => {
	const character = committedCharacter('ferryman');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition carousel', () => {
			expect(character.name).toBe('Ferryman');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('ferryman')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'ability', name: 'ghost-votes', time: 'day' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Ferryman#Examples)', () => {
		it.fails('Example 1: Forgetful dead players get votes back', () => {
			// Wiki: "Most of the group is new. Two players, Amy and Doug, forgot they were dead in the
			// excitement of voting. The Storyteller puts the Ferryman in play. Later in the game, when
			// there are three players left alive, the Storyteller declares that it is the final day. Amy
			// and Doug regain their vote tokens."
			// Waits on the engine (M9): the Ferryman in play on the final day doesn't give back spent ghost
			// votes.
			const spent = scenario(['chef', 'empath', 'monk', 'soldier', 'imp', 'poisoner'])
				.dies('chef')
				.dies('soldier')
				.do(
					(at) => ({ type: 'SpendGhostVote', seatId: at.seat('chef') }),
					(at) => ({ type: 'SpendGhostVote', seatId: at.seat('soldier') })
				)
				.rule('ferryman')
				.dies('empath', 'imp');
			expect(spent.game.seating.filter((id) => !spent.game.seats[id].dead)).toHaveLength(3);
			expect(ghostVotesLeft(spent.game, spent.characters)).toBe(3);
		});
		it.fails('Example 2: Ten used ghost votes restored for the finale', () => {
			// Wiki: "It is the start of the final day. 17 players are dead and three players are alive. 10
			// dead players have used their vote tokens. In order to create a more fun and engaging final
			// day, the Storyteller adds the Ferryman and those dead players regain their vote tokens.
			// After a riotously entertaining final day, the Storyteller is celebrated for maximizing the
			// players’ enjoyment."
			// Waits on the engine (M9): as in Example 1. Twelve seats at most here: nine dead, six of them
			// with their vote spent, and three alive.
			const cast = [
				'washerwoman',
				'librarian',
				'investigator',
				'chef',
				'empath',
				'fortuneteller',
				'undertaker',
				'monk',
				'ravenkeeper',
				'soldier',
				'poisoner',
				'imp'
			];
			let s = scenario(cast);
			for (const dead of cast.slice(0, 9)) s = s.dies(dead);
			for (const spent of cast.slice(0, 6))
				s = s.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat(spent) }));
			expect(ghostVotesLeft(s.game, s.characters)).toBe(3);
			const finale = s.rule('ferryman');
			expect(ghostVotesLeft(finale.game, finale.characters)).toBe(9);
		});
	});
});
