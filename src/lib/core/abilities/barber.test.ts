/**
 * Barber: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Barber
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Barber.
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
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { swappableSeats } from '#lib/core/rules/becomes.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Barber', () => {
	const character = committedCharacter('barber');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition snv', () => {
			expect(character.name).toBe('Barber');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Haircuts Tonight']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('barber')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Barber#Examples)', () => {
		const swappable = (s: Scenario) => swappableSeats(s.game, 'barber', s.characters);
		const haircut = (s: Scenario, a: string, b: string) =>
			s.do((at) => ({
				type: 'SwapCharacters',
				seatId: at.seat(a),
				withSeatId: at.seat(b),
				keepAlignments: true
			}));

		it('Example 1: Demon considers a swap but declines', () => {
			// Wiki: "The Barber dies. The Demon considers swapping the Clockmaker and the Juggler, but then
			// does nothing."
			const s = scenario(['barber', 'clockmaker', 'juggler', 'imp', 'poisoner']).dies('barber');
			expect(
				reminderTargetMisses(
					s.game,
					{ characterId: 'barber', label: 'Haircuts Tonight' },
					s.seat('barber'),
					s.characters
				)
			).toEqual([]);
			expect(swappable(s)).toEqual(
				expect.arrayContaining([s.seat('clockmaker'), s.seat('juggler')])
			);
		});

		it('Example 2: Live Snake Charmer swaps with dead Barber', () => {
			// Wiki: "The Barber dies. The Demon swaps the alive Snake Charmer with the dead Barber. Now, there
			// is an alive Barber and a dead Snake Charmer."
			const s = scenario(['barber', 'snakecharmer', 'chef', 'imp', 'poisoner']).dies('barber');
			expect(swappable(s)).toEqual(
				expect.arrayContaining([s.seat('barber'), s.seat('snakecharmer')])
			);
			const after = haircut(s, 'snakecharmer', 'barber');
			expect(after.game.seats[s.seat('snakecharmer')]).toMatchObject({
				characterId: 'barber',
				dead: false
			});
			expect(after.game.seats[s.seat('barber')]).toMatchObject({
				characterId: 'snakecharmer',
				dead: true
			});
		});

		it('Example 3: Vortox swaps with a living Witch', () => {
			// Wiki: "The Barber dies. The Vortox swaps themself with an alive Witch."
			const s = scenario(['barber', 'witch', 'chef', 'vortox', 'empath']).dies('barber');
			const after = haircut(s, 'vortox', 'witch');
			expect(after.game.seats[s.seat('witch')]).toMatchObject({
				characterId: 'vortox',
				alignment: 'evil'
			});
			// Only "another Demon" is barred: the Demon may choose itself.
			expect(swappable(s)).toEqual(expect.arrayContaining([s.seat('vortox'), s.seat('witch')]));
		});

		it('Example 4: Vigormortis swaps with dead Sweetheart; game continues', () => {
			// Wiki: "The Barber dies. The Vigormortis swaps themself with a dead Sweetheart. The old
			// Vigormortis is now the evil Sweetheart. Because the Pit-Hag created a good Demon during the
			// previous night, the game continues."
			const s = scenario(['barber', 'sweetheart', 'pithag', 'vigormortis', 'chef', 'empath'])
				.becomes('chef', 'nodashii', 'good')
				.dies('sweetheart')
				.newDay()
				.dies('barber');
			const after = haircut(s, 'vigormortis', 'sweetheart');
			expect(after.game.seats[s.seat('vigormortis')]).toMatchObject({
				characterId: 'sweetheart',
				alignment: 'evil',
				dead: false
			});
			expect(gameEnds(after.game, after.characters)).toEqual([]);
			// Only "another Demon" is barred: the Demon may choose itself.
			expect(swappable(s)).toEqual(
				expect.arrayContaining([s.seat('vigormortis'), s.seat('sweetheart')])
			);
		});
	});
});
