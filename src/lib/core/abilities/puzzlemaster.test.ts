/**
 * Puzzlemaster: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Puzzlemaster
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Puzzlemaster.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
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
import { scenario } from '#lib/core/testing/scenario.ts';
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
		// The Puzzlemaster, Alex the Demon, an Empath, a Sailor and a Chef.
		const table = () => scenario(['puzzlemaster', 'imp', 'empath', 'sailor', 'chef']);

		it('Example 1: guessing the player it made drunk learns the Demon player', () => {
			// Wiki: "Alex is the Demon. Sarah is the Empath who has been made drunk by the Puzzlemaster
			// and is getting false information. The Puzzlemaster publicly guesses that Sarah is drunk, and
			// is told “Alex is the Demon” privately by the Storyteller."
			// The Empath carries the Puzzlemaster's Drunk; guessing her is right: Alex, the Demon.
			const s = table().reminder('empath', 'puzzlemaster', 'Drunk');
			expect(
				dayUseAnswer(s.game, s.seat('puzzlemaster'), 'puzzlemaster', s.seat('empath'), s.characters)
			).toEqual({ kind: 'right', demons: [s.seat('imp')] });
		});

		it('Example 2: a player drunk by another ability is a wrong guess', () => {
			// Wiki: "Lewis is the Demon. Ben is dead and is drunk due to the Puzzlemaster. Marianna is
			// alive and drunk due to the Sailor. The Puzzlemaster privately guesses Marianna, and is told
			// “Evin is the Demon” privately by the Storyteller."
			// The Chef is dead and drunk by the Puzzlemaster; the Sailor's own player is drunk by
			// the Sailor. Guessing the Sailor's player is wrong: anyone but the Demon.
			const s = table()
				.reminder('chef', 'puzzlemaster', 'Drunk')
				.reminder('sailor', 'sailor', 'Drunk')
				.dies('chef');
			expect(
				dayUseAnswer(s.game, s.seat('puzzlemaster'), 'puzzlemaster', s.seat('sailor'), s.characters)
			).toEqual({ kind: 'wrong', demons: [s.seat('imp')] });
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
