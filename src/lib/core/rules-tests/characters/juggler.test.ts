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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightAnswer } from '#lib/core/rules/night/info/answers.ts';
import { reminderTargets } from '#lib/core/rules/reminders/reminder-targets.ts';
import { dayClaim, guessLimit } from '#lib/core/rules/day/day-claims.ts';
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day/day-reminders.ts';
import { wokeTonight } from '#lib/core/rules/night/woke-tonight.ts';
import {
	committedCharacter,
	nightSheetPresence,
	committedCharacters
} from '#lib/core/testing/committed-data.ts';
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
			// Wiki: "During the first day, the Juggler guesses that Alex is the Town Crier, Mia is the No
			// Dashii, and Julian is the Sage. That night, the Juggler learns a "2," meaning two of those
			// guesses were correct."
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
			// Wiki: "During the fourth night, the Savant gets turned into the Juggler. The next day, the
			// new Juggler guesses that Benjamin is the Pit-Hag, that Benjamin is the Witch, and that Amy
			// is the Pit-Hag. That night, the Juggler learns a "1.”"
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

	// Wiki (How to Run): "For each correct guess, mark the Juggler with a CORRECT reminder."
	// "Show them fingers (0, 1, 2, etc.) equaling the number of CORRECT reminders." Trevor (2026-11-02): the reminder goes on the player guessed
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Juggler#How_to_Run)', () => {
		const cast = ['juggler', 'witch', 'nodashii', 'savant', 'chef'];
		const mayJuggle = (s: Scenario) =>
			dayReminders(dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters))
				.groups.flatMap((g) => g.reminders)
				.some((r) => r.characterId === 'juggler');

		it('may make up to five guesses on the first day', () => {
			// Wiki: "During the first day, if the Juggler declares that they are using their ability,
			// then you enter the circle, holding the Grimoire. The Juggler can make up to five guesses,
			// each of any one player and any one character."
			const s = scenario(cast).newDay();
			expect(mayJuggle(s)).toBe(true);
			expect(dayClaim('juggler', committedCharacters())).toBe('guesses');
			expect(guessLimit('juggler', committedCharacters())).toBe(5);
		});

		it('is not offered guesses after the first day', () => {
			// Wiki: "During the first day, if the Juggler declares that they are using their ability,
			// then you enter the circle, holding the Grimoire."
			const s = scenario(cast).newDay().newDay();
			expect(mayJuggle(s)).toBe(false);
		});

		it('wakes only on the night after the first day', () => {
			// Wiki: "Remove the CORRECT reminders and the Juggler’s night token when convenient."
			const s = scenario(cast).newDay();
			expect(wokeTonight(s.game, s.seat('juggler'), s.characters, 'other')).toBe(true);
			const later = s.newDay();
			expect(wokeTonight(later.game, later.seat('juggler'), later.characters, 'other')).toBe(false);
		});
	});
});
