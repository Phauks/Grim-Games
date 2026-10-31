/**
 * Puzzlemaster: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Puzzlemaster
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Puzzlemaster.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { dayUseAnswer, dayUseOf } from '#lib/core/rules/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

/**
 * Seats 0 to 4: the Puzzlemaster, Alex the Demon, an Empath, a Sailor and a Chef, with the
 * extra commands run after.
 */
function table(...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(['Pat', 'Alex', 'Sarah', 'Marianna', 'Ben']);
	const s = run(
		session,
		ctx,
		...['puzzlemaster', 'imp', 'empath', 'sailor', 'chef'].map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra.map((command) => command(seats))
	);
	return { game: s.game, seats };
}
/** A reminder of `characterId`'s on seat `n`. */
const reminder =
	(n: number, characterId: string, label: string) =>
	(seats: string[]): Command => ({
		type: 'AddReminder',
		seatId: seats[n],
		reminder: { characterId, label }
	});
const drunkOn = (n: number) => reminder(n, 'puzzlemaster', 'Drunk');

describe('Puzzlemaster', () => {
	const character = committedCharacter('puzzlemaster');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Puzzlemaster');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk', 'Guess Used']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('puzzlemaster')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Puzzlemaster#Examples)', () => {
		it('Example 1: guessing the player it made drunk learns the Demon player', () => {
			// The Empath carries the Puzzlemaster's Drunk; guessing her is right: Alex, the Demon.
			const { game, seats } = table(drunkOn(2));
			expect(dayUseAnswer(game, seats[0], 'puzzlemaster', seats[2], characters)).toEqual({
				kind: 'right',
				demons: [seats[1]]
			});
		});

		it('Example 2: a player drunk by another ability is a wrong guess', () => {
			// The Chef is dead and drunk by the Puzzlemaster; the Sailor's own player is drunk by
			// the Sailor. Guessing the Sailor's player is wrong: anyone but the Demon.
			const { game, seats } = table(drunkOn(4), reminder(3, 'sailor', 'Drunk'), (seats) => ({
				type: 'SetDead',
				seatId: seats[4],
				dead: true
			}));
			expect(dayUseAnswer(game, seats[0], 'puzzlemaster', seats[3], characters)).toEqual({
				kind: 'wrong',
				demons: [seats[1]]
			});
		});
	});

	describe('the guess (https://wiki.bloodontheclocktower.com/Puzzlemaster)', () => {
		it('asks whom they guessed, and marks it Guess Used', () => {
			expect(dayUseOf('puzzlemaster')).toEqual({
				who: 'guessed',
				spentToken: 'Guess Used',
				answer: 'demon-if-marked'
			});
		});

		it('gives any player while the Puzzlemaster is poisoned', () => {
			const { game, seats } = table(drunkOn(2), reminder(0, 'poisoner', 'Poisoned'));
			expect(dayUseAnswer(game, seats[0], 'puzzlemaster', seats[2], characters)).toEqual({
				kind: 'any'
			});
		});

		it('gives nothing once the Puzzlemaster is dead: the dead may not guess', () => {
			const { game, seats } = table(drunkOn(2), (seats) => ({
				type: 'SetDead',
				seatId: seats[0],
				dead: true
			}));
			expect(dayUseAnswer(game, seats[0], 'puzzlemaster', seats[2], characters)).toEqual({
				kind: 'dead'
			});
		});
	});
});
