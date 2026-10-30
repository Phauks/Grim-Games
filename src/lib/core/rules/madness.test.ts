/**
 * Breaking madness (`madness` in a character's rules): the Storyteller may execute a player
 * the Cerenovus made mad who is not trying to seem the character chosen
 * (https://wiki.bloodontheclocktower.com/Cerenovus), and the Mutant who tries to seem an
 * Outsider (https://wiki.bloodontheclocktower.com/Mutant); for the Harpy, the 1st player,
 * the 2nd, both or neither might die, never a dead one
 * (https://wiki.bloodontheclocktower.com/Harpy).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { madnessOffer } from './madness.ts';

const remind =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});
const dead =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'execution' });

describe('breaking madness (madness)', () => {
	it('is the Cerenovus, the Harpy and the Mutant', () => {
		const mad = [...OFFICIAL_RULES].filter(([, r]) => r.madness).map(([id]) => id);
		expect(mad.sort()).toEqual(['cerenovus', 'harpy', 'mutant']);
	});

	it('offers to execute the player with the Cerenovus token, and no one else', () => {
		const { session, seats } = castGame(
			['cerenovus', 'chef', 'empath', 'imp'],
			remind(1, 'cerenovus', 'Mad')
		);
		const game = session.game;
		expect(madnessOffer(game, 'cerenovus', seats[1], characters)).toEqual({
			characterId: 'cerenovus',
			seatId: seats[1],
			breaking: 'execution',
			dies: []
		});
		expect(madnessOffer(game, 'cerenovus', seats[2], characters)).toBeUndefined();
	});

	it('offers to execute the Mutant only while their ability works', () => {
		const sober = castGame(['mutant', 'chef', 'imp']);
		expect(madnessOffer(sober.session.game, 'mutant', sober.seats[0], characters)?.breaking).toBe(
			'execution'
		);
		expect(madnessOffer(sober.session.game, 'mutant', sober.seats[1], characters)).toBeUndefined();
		const poisoned = castGame(['mutant', 'poisoner', 'imp'], remind(0, 'poisoner', 'Poisoned'));
		expect(
			madnessOffer(poisoned.session.game, 'mutant', poisoned.seats[0], characters)
		).toBeUndefined();
	});

	it('offers the Harpy’s 1st and 2nd players to die, leaving out a dead one', () => {
		const both = castGame(
			['harpy', 'chef', 'empath', 'imp'],
			remind(1, 'harpy', 'Mad'),
			remind(2, 'harpy', '2nd')
		);
		expect(madnessOffer(both.session.game, 'harpy', both.seats[1], characters)).toEqual({
			characterId: 'harpy',
			seatId: both.seats[1],
			breaking: 'death',
			dies: [both.seats[1], both.seats[2]]
		});
		const deadSecond = castGame(
			['harpy', 'chef', 'empath', 'imp'],
			remind(1, 'harpy', 'Mad'),
			remind(2, 'harpy', '2nd'),
			dead(2)
		);
		expect(
			madnessOffer(deadSecond.session.game, 'harpy', deadSecond.seats[1], characters)?.dies
		).toEqual([deadSecond.seats[1]]);
	});
});
