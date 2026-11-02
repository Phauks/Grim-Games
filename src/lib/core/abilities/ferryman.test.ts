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
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { blockThreshold } from '#lib/core/rules/voting.ts';
import { ghostVotesRestored } from '#lib/core/rules/voting-table.ts';

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
		it('Example 1: Forgetful dead players get votes back', () => {
			// Wiki: "Most of the group is new. Two players, Amy and Doug, forgot they were dead in the
			// excitement of voting. The Storyteller puts the Ferryman in play. Later in the game, when
			// there are three players left alive, the Storyteller declares that it is the final day. Amy
			// and Doug regain their vote tokens."
			let s = scenario(['chef', 'empath', 'monk', 'soldier', 'mayor', 'imp']);
			for (const dead of ['chef', 'empath', 'monk'] as const)
				s = s.dies(dead, 'imp').do((at) => ({ type: 'SpendGhostVote', seatId: at.seat(dead) }));
			s = s.do((at) => ({ type: 'RestoreGhostVote', seatId: at.seat('monk') }));
			// Amy (the Chef) and Doug (the Empath) forgot they were dead and voted.
			const ferried = s.rule('ferryman');
			expect(blockThreshold(ferried.game).alive).toBe(3);
			expect(ghostVotesRestored(ferried.game, ferried.characters, true)).toEqual([
				s.seat('chef'),
				s.seat('empath')
			]);
		});
		it('Example 2: Ten used ghost votes restored for the finale', () => {
			// Wiki: "It is the start of the final day. 17 players are dead and three players are alive. 10
			// dead players have used their vote tokens. In order to create a more fun and engaging final
			// day, the Storyteller adds the Ferryman and those dead players regain their vote tokens.
			// After a riotously entertaining final day, the Storyteller is celebrated for maximizing the
			// players’ enjoyment."
			const cast = [
				'chef',
				'empath',
				'monk',
				'soldier',
				'mayor',
				'slayer',
				'virgin',
				'ravenkeeper',
				'undertaker',
				'fortuneteller',
				'investigator',
				'librarian',
				'washerwoman',
				'butler',
				'recluse',
				'saint',
				'drunk',
				'poisoner',
				'spy',
				'imp'
			];
			let s = scenario(cast);
			cast.slice(0, 17).forEach((dead, i) => {
				s = s.dies(dead, 'imp');
				if (i < 10) s = s.do((at) => ({ type: 'SpendGhostVote', seatId: at.seat(dead) }));
			});
			const ferried = s.rule('ferryman');
			const back = ghostVotesRestored(ferried.game, ferried.characters, true);
			expect(back).toEqual(cast.slice(0, 10).map((id) => s.seat(id)));
			const after = back.reduce(
				(at, seatId) => at.do({ type: 'RestoreGhostVote', seatId }),
				ferried
			);
			expect(ghostVotesRestored(after.game, after.characters, true)).toEqual([]);
		});
	});
});
