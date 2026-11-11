/**
 * Gardener: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gardener
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gardener.
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
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';
import { nextDrawSeat } from '#lib/core/rules/bag-plan.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Gardener', () => {
	const character = committedCharacter('gardener');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Gardener');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('gardener')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'ability', name: 'distribute-roles', time: 'pregame' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gardener#Examples)', () => {
		it('Example 1: Gardener assigns hidden characters', () => {
			// Wiki: "The Storyteller wants to set up a game that has the Wraith, Lord of Typhon,
			// Cerenovus, Zealot, Monk, Alsaahir, Banshee, High Priestess, and Balloonist. The
			// Storyteller sets up these characters in this order, places them face down, and the
			// players take their tokens. Ben is the Lord of Typhon and Julian is the High
			// Priestess."
			// Seated in the order chosen: Ben (the second seat) is the Lord of Typhon, between its
			// two Minions, and Hal stands in for Julian as the High Priestess.
			const cast = [
				'wraith',
				'lordoftyphon',
				'cerenovus',
				'zealot',
				'monk',
				'alsaahir',
				'banshee',
				'highpriestess',
				'balloonist'
			];
			const s = scenario(cast).rule('gardener');
			expect(s.game.seats[s.seat(1)]).toMatchObject({
				playerName: 'Ben',
				characterId: 'lordoftyphon'
			});
			expect(s.game.seats[s.seat('highpriestess')].characterId).toBe('highpriestess');
			const gardener = s.characters.get('gardener')!;
			expect(setupModifierFor(gardener)?.notes).toEqual([
				'No bag: the Storyteller chooses each player’s character.'
			]);
			const inPlay = [...cast.map((id) => s.characters.get(id)!), gardener];
			expect(analyseSetup({ players: 9, inPlay }).warnings).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Gardener#How_to_Run)', () => {
		it('reads its setup change as the Storyteller placing the characters, with no bag', () => {
			// Wiki: "During setup, instead of putting the character tokens in the bag, put them
			// face-down on the Town Square, or a firm object like a book, in a circle or shape that
			// matches the physical seating arrangement."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('gardener');
			expect(setupModifierFor(s.characters.get('gardener')!)).toMatchObject({
				summary: 'Storyteller assigns characters',
				ops: []
			});
		});

		it('fills the seats one at a time, in seating order', () => {
			// Wiki: "One at a time, in clockwise order, prompt the players to take the token that
			// corresponds with their physical seating position."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('gardener');
			const empty = s.do(...s.seats.map((seatId) => ({ type: 'ClearCharacter' as const, seatId })));
			expect(nextDrawSeat(empty.game)).toBe(s.seat(0));
			const first = empty.becomes(0, 'chef');
			expect(nextDrawSeat(first.game)).toBe(s.seat(1));
		});
	});
});
