/**
 * A character's own condition for waking (`wakesWhen`). Each scenario paraphrases the wiki
 * page it encodes:
 * - https://wiki.bloodontheclocktower.com/King: learns only once the dead equal or outnumber
 *   the living;
 * - https://wiki.bloodontheclocktower.com/Choirboy: wakes when the Demon kills the King, not
 *   when anything else does;
 * - https://wiki.bloodontheclocktower.com/Seamstress: once per game;
 * - https://wiki.bloodontheclocktower.com/Zombuul: only when nobody died today.
 */
import { describe, expect, it } from 'vitest';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { wakeConditionMet } from './wakes-when.ts';

const dead = (n: number) => (s: string[]) => ({
	type: 'SetDead' as const,
	seatId: s[n],
	dead: true
});

describe('wakeConditionMet', () => {
	it('wakes the King once the dead equal or outnumber the living', () => {
		const cast = ['king', 'chef', 'imp', 'monk'];
		const early = castGame(cast, dead(1));
		expect(wakeConditionMet(early.game, 'king', early.seats[0], characters, new Set())).toBe(false);
		const late = castGame(cast, dead(1), dead(3));
		expect(wakeConditionMet(late.game, 'king', late.seats[0], characters, new Set())).toBe(true);
	});

	it('wakes the Choirboy when the Demon killed the King tonight', () => {
		const cast = ['choirboy', 'king', 'imp', 'monk'];
		const killed = castGame(cast, (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true,
			cause: 'imp'
		}));
		const { game, seats } = killed;
		expect(wakeConditionMet(game, 'choirboy', seats[0], characters, new Set([seats[1]]))).toBe(
			true
		);
		// Nobody died tonight: no wake.
		expect(wakeConditionMet(game, 'choirboy', seats[0], characters, new Set())).toBe(false);
	});

	it('does not wake the Choirboy when the King was executed', () => {
		const { game, seats } = castGame(['choirboy', 'king', 'imp', 'monk'], (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true,
			cause: 'execution'
		}));
		expect(wakeConditionMet(game, 'choirboy', seats[0], characters, new Set([seats[1]]))).toBe(
			false
		);
	});

	it('stops waking the Seamstress once her No Ability is placed', () => {
		const fresh = castGame(['seamstress', 'chef', 'imp']);
		expect(wakeConditionMet(fresh.game, 'seamstress', fresh.seats[0], characters, new Set())).toBe(
			true
		);
		const used = castGame(['seamstress', 'chef', 'imp'], (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'seamstress', label: 'No Ability' }
		}));
		expect(wakeConditionMet(used.game, 'seamstress', used.seats[0], characters, new Set())).toBe(
			false
		);
	});

	// https://wiki.bloodontheclocktower.com/Zombuul: wakes only when nobody died today.
	it('wakes the Zombuul only when nobody died today', () => {
		const cast = ['zombuul', 'chef', 'imp', 'monk'];
		const quiet = castGame(cast);
		expect(wakeConditionMet(quiet.game, 'zombuul', quiet.seats[0], characters, new Set())).toBe(
			true
		);
		const died = castGame(cast, dead(1));
		expect(
			wakeConditionMet(died.game, 'zombuul', died.seats[0], characters, new Set([died.seats[1]]))
		).toBe(false);
		const executed = castGame(cast, (s) => ({ type: 'Execute', seatId: s[1] }));
		expect(
			wakeConditionMet(executed.game, 'zombuul', executed.seats[0], characters, new Set())
		).toBe(false);
	});

	it('leaves characters without a condition alone', () => {
		const { game, seats } = castGame(['chef', 'imp']);
		expect(wakeConditionMet(game, 'chef', seats[0], characters, new Set())).toBe(true);
	});
});
