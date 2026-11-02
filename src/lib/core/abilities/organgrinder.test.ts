/**
 * Organ Grinder: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Organ_Grinder
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Organ Grinder.
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
import { blockThreshold } from '#lib/core/rules/voting.ts';
import { votesSecret } from '#lib/core/rules/voting-table.ts';
import { total, votes } from '#lib/core/testing/votes.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { scenario, type SeatRef } from '#lib/core/testing/scenario.ts';

describe('Organ Grinder', () => {
	const character = committedCharacter('organgrinder');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Organ Grinder');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['About To Die', 'Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('organgrinder')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'vote', name: 'hidden' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Organ_Grinder#Examples)', () => {
		it('Example 1: Secret votes, Imp executed, good wins', () => {
			// Wiki: "There are 8 players alive. The Noble is nominated. All players close eyes to vote and
			// the Noble gets 5 votes. The Imp is nominated. All players close eyes to vote and the Imp
			// gets 7 votes. The Pixie is nominated. All players close eyes to vote and the Pixie gets 4
			// votes. After nominations close, the Storyteller declares that Doug (the Imp) is executed and
			// dies, and that good has won."
			let s = scenario([
				'organgrinder',
				'noble',
				'imp',
				'pixie',
				'chef',
				'empath',
				'monk',
				'soldier'
			]);
			expect(votesSecret(s.game, s.characters)).toBe(true);
			// The Storyteller still counts, privately: 4 of 8 living players are needed.
			expect(blockThreshold(s.game, s.characters)).toEqual({ alive: 8, needed: 4 });
			const tallies: number[] = [];
			const rounds: [SeatRef, SeatRef[]][] = [
				['noble', ['chef', 'empath', 'monk', 'soldier', 'pixie']],
				['imp', ['chef', 'empath', 'monk', 'soldier', 'pixie', 'noble', 'organgrinder']],
				['pixie', ['chef', 'empath', 'monk', 'soldier']]
			];
			for (const [nominee, voters] of rounds) {
				s = votes(s.nominate('chef', nominee), ...voters);
				tallies.push(total(s)!);
			}
			expect(tallies).toEqual([5, 7, 4]);
			const executed = s.execute('imp');
			expect(gameEnds(executed.game, executed.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good' }
			]);
		});
	});
});
