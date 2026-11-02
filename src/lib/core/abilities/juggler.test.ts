/**
 * Juggler: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Juggler
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Juggler.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightAnswer, reminderTargets } from '#lib/core/rules/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** What the Storyteller gives the Juggler tonight. */
function answer(s: Scenario) {
	return nightAnswer(s.game, s.seat('juggler'), 'juggler', s.characters);
}

describe('Juggler', () => {
	const character = committedCharacter('juggler');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Juggler');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Correct', 'Correct', 'Correct', 'Correct', 'Correct']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('juggler')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Juggler#Examples)', () => {
		// Three guesses on the first day, two of them naming the player's real character: the
		// Juggler learns 2.
		it("Example 1: Juggler's three guesses yield two correct", () => {
			const s = scenario(['juggler', 'towncrier', 'nodashii', 'savant']).do((s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				seatId: s.seat('juggler'),
				text: '',
				guesses: [
					{ seatId: s.seat('towncrier'), characterId: 'towncrier' },
					{ seatId: s.seat('nodashii'), characterId: 'nodashii' },
					{ seatId: s.seat('savant'), characterId: 'sage' }
				]
			}));
			expect(answer(s)).toMatchObject({ kind: 'number', value: 2 });
		});

		// A Juggler made mid-game guesses one player as two characters and another player as one
		// of them; only one guess is right, so the Juggler learns 1.
		it('Example 2: Savant-turned Juggler gets one right', () => {
			const s = scenario(['juggler', 'witch', 'pithag', 'nodashii']).do((s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				seatId: s.seat('juggler'),
				text: '',
				guesses: [
					{ seatId: s.seat('witch'), characterId: 'pithag' },
					{ seatId: s.seat('witch'), characterId: 'witch' },
					{ seatId: s.seat('pithag'), characterId: 'witch' }
				]
			}));
			expect(answer(s)).toMatchObject({ kind: 'number', value: 1 });
		});
	});

	// How to Run: each correct guess gets a Correct reminder, and the Juggler learns how many
	// Correct reminders there are. Trevor (2026-11-02): the reminder goes on the player guessed
	// right, which may be the Juggler themselves, the same player more than once, or nobody.
	describe('Correct reminders', () => {
		const cast = ['juggler', 'witch', 'nodashii', 'savant'];

		it('may go on any player, the Juggler included', () => {
			const s = scenario(cast);
			const fits = reminderTargets(
				s.game,
				{ characterId: 'juggler', label: 'Correct' },
				s.characters
			);
			expect(fits.every((f) => f.misses.length === 0)).toBe(true);
		});

		it('gives the Juggler how many Correct reminders are on the board', () => {
			const s = scenario(cast)
				.reminder('juggler', 'juggler', 'Correct')
				.reminder('witch', 'juggler', 'Correct')
				.reminder('witch', 'juggler', 'Correct');
			expect(answer(s)).toMatchObject({
				kind: 'number',
				value: 3,
				because: [s.seat('juggler'), s.seat('witch')]
			});
		});

		it('the reminders win over the logged guesses once any are placed', () => {
			const s = scenario(cast)
				.do((s) => ({
					type: 'DayNote',
					characterId: 'juggler',
					seatId: s.seat('juggler'),
					text: '',
					guesses: [
						{ seatId: s.seat('witch'), characterId: 'witch' },
						{ seatId: s.seat('nodashii'), characterId: 'nodashii' }
					]
				}))
				.reminder('savant', 'juggler', 'Correct');
			expect(answer(s)).toMatchObject({ kind: 'number', value: 1, because: [s.seat('savant')] });
		});

		// Trevor, 2026-11-02: "if you guess twice, it is two separate guesses, counts twice".
		it('counts the same right guess made twice as two', () => {
			const s = scenario(cast).do((s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				seatId: s.seat('juggler'),
				text: '',
				guesses: [
					{ seatId: s.seat('witch'), characterId: 'witch' },
					{ seatId: s.seat('witch'), characterId: 'witch' }
				]
			}));
			expect(answer(s)).toMatchObject({ kind: 'number', value: 2, because: [s.seat('witch')] });
		});

		it('with no reminders and no right guesses, the Juggler learns 0', () => {
			const s = scenario(cast).do((s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				seatId: s.seat('juggler'),
				text: '',
				guesses: [{ seatId: s.seat('witch'), characterId: 'savant' }]
			}));
			expect(answer(s)).toMatchObject({ kind: 'number', value: 0, because: [] });
		});
	});
});
