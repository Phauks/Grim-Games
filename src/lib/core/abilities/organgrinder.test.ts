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
import { abilityState } from '#lib/core/rules/ability.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { remindersEndingAt } from '#lib/core/rules/reminder-ends.ts';
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Organ_Grinder#How_to_Run)', () => {
		const cast = ['organgrinder', 'chef', 'empath', 'imp', 'poisoner'];

		it('puts Drunk only on the Organ Grinder, who is then drunk', () => {
			// Wiki: "Each night, wake the Organ Grinder. The Organ Grinder either nods or shakes their
			// head. If they nod their head, mark them with the DRUNK reminder."
			const s = scenario(cast);
			const drunk = { characterId: 'organgrinder', label: 'Drunk' };
			expect(reminderTargetMisses(s.game, drunk, s.seat('organgrinder'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, drunk, s.seat('chef'), s.characters)).toEqual([
				'not-self'
			]);
			const nodded = s.reminder('organgrinder', 'organgrinder', 'Drunk');
			expect(
				abilityState(nodded.game, nodded.seat('organgrinder'), nodded.characters)
			).toMatchObject({ works: false });
		});

		it('keeps votes secret only while the Organ Grinder is sober', () => {
			// Wiki: "When a player has been nominated and a vote is just about to begin, and the Organ
			// Grinder is sober, ask all players to close their eyes."
			const s = scenario(cast);
			expect(votesSecret(s.game, s.characters)).toBe(true);
			const drunk = s.reminder('organgrinder', 'organgrinder', 'Drunk');
			expect(votesSecret(drunk.game, drunk.characters)).toBe(false);
		});

		it('marks a living nominee with enough votes About To Die', () => {
			// Wiki: "If there were enough votes to execute the nominee, mark them with the ABOUT TO DIE
			// reminder."
			const s = scenario(cast).dies('empath');
			const about = { characterId: 'organgrinder', label: 'About To Die' };
			expect(reminderTargetMisses(s.game, about, s.seat('chef'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, about, s.seat('imp'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, about, s.seat('empath'), s.characters)).not.toEqual([]);
		});

		it('takes Drunk off the Organ Grinder at each dusk', () => {
			// Wiki: "Each dusk, remove the DRUNK reminder."
			const s = scenario(cast).reminder('organgrinder', 'organgrinder', 'Drunk');
			const drunkId = s.game.seats[s.seat('organgrinder')].reminders[0]!.reminderId;
			expect(remindersEndingAt(s.game, 'dusk', s.characters)).toContain(drunkId);
		});
	});
});
