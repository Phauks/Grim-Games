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
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

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
		it("Example 1: Juggler's three guesses yield two correct", () => {
			// Wiki: "During the first day, the Juggler guesses that Alex is the Town Crier, Mia is the No
			// Dashii, and Julian is the Sage. That night, the Juggler learns a "2," meaning two of those
			// guesses were correct."
			// Alex is the Town Crier, Mia the No Dashii, and Julian the Savant.
			const s = scenario(['juggler', 'towncrier', 'nodashii', 'savant', 'witch']).do((at) => ({
				type: 'DayNote',
				characterId: 'juggler',
				seatId: at.seat('juggler'),
				text: '',
				guesses: [
					{ seatId: at.seat('towncrier'), characterId: 'towncrier' },
					{ seatId: at.seat('nodashii'), characterId: 'nodashii' },
					{ seatId: at.seat('savant'), characterId: 'sage' }
				]
			}));
			expect(nightAnswer(s.game, s.seat('juggler'), 'juggler', s.characters)).toMatchObject({
				kind: 'number',
				value: 2,
				because: [s.seat('towncrier'), s.seat('nodashii')]
			});
		});

		it('Example 2: Savant-turned Juggler gets one right', () => {
			// Wiki: "During the fourth night, the Savant gets turned into the Juggler. The next day, the
			// new Juggler guesses that Benjamin is the Pit-Hag, that Benjamin is the Witch, and that Amy
			// is the Pit-Hag. That night, the Juggler learns a "1.”"
			// Benjamin is the Pit-Hag and Amy the Witch.
			const s = scenario(['savant', 'pithag', 'witch', 'chef', 'nodashii'])
				.newDay()
				.newDay()
				.newDay()
				.becomes('savant', 'juggler')
				.newDay()
				.do((at) => ({
					type: 'DayNote',
					characterId: 'juggler',
					seatId: at.seat('savant'),
					text: '',
					guesses: [
						{ seatId: at.seat('pithag'), characterId: 'pithag' },
						{ seatId: at.seat('pithag'), characterId: 'witch' },
						{ seatId: at.seat('witch'), characterId: 'pithag' }
					]
				}));
			expect(nightAnswer(s.game, s.seat('savant'), 'juggler', s.characters)).toMatchObject({
				kind: 'number',
				value: 1,
				because: [s.seat('pithag')]
			});
		});
	});
});
