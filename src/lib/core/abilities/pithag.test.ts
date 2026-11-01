/**
 * Pit-Hag: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pit-Hag
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Pit-Hag.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { characterChanger, changeableSeats } from '#lib/core/rules/becomes.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { reminderTargets } from '#lib/core/rules/reminder-targets.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Pit-Hag', () => {
	const character = committedCharacter('pithag');

	describe('data (roles.json)', () => {
		it('is a Minion from edition snv', () => {
			expect(character.name).toBe('Pit-Hag');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('pithag')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Pit-Hag#Examples)', () => {
		it('Example 1: Clockmaker becomes a Mutant', () => {
			// Wiki: "The Pit-Hag turns the Clockmaker into the Mutant."
			const s = scenario(['pithag', 'clockmaker', 'chef', 'empath', 'nodashii']).newDay();
			expect(characterChanger(s.game, 'pithag', s.characters)).toBe(s.seat('pithag'));
			expect(changeableSeats(s.game, 'pithag', s.characters)).toContain(s.seat('clockmaker'));
			const after = s.becomes('clockmaker', 'mutant');
			expect(after.game.seats[after.seat('clockmaker')]).toMatchObject({
				characterId: 'mutant',
				alignment: 'good'
			});
			// They are the Mutant now, mad about being an Outsider.
			expect(
				madnessOffer(after.game, 'mutant', after.seat('clockmaker'), after.characters)
			).toBeDefined();
		});

		it("Example 2: Savant can't become Sage, already in play", () => {
			// Wiki: "The Pit-Hag tries to turn the Savant into the Sage, but nothing happens because a Sage
			// is already in play."
			const s = scenario(['pithag', 'savant', 'sage', 'chef', 'nodashii']).newDay();
			expect(
				warned(s.session, s.ctx, {
					type: 'AssignCharacter',
					seatId: s.seat('savant'),
					characterId: 'sage'
				})
			).toContain('already-in-play');
		});

		it('Example 3: Flowergirl becomes Evil Twin; twins learn each other', () => {
			// Wiki: "The Pit-Hag turns the Flowergirl into the Evil Twin. Now, there is a good Evil Twin, so
			// the Evil Twin and an evil player are woken to learn each other's character."
			const s = scenario(['pithag', 'flowergirl', 'chef', 'empath', 'witch', 'nodashii'])
				.newDay()
				.becomes('flowergirl', 'eviltwin');
			expect(s.game.seats[s.seat('flowergirl')]).toMatchObject({
				characterId: 'eviltwin',
				alignment: 'good'
			});
			// The twin must be of the opposite alignment: an evil player.
			const twins = reminderTargets(
				s.game,
				{ characterId: 'eviltwin', label: 'Twin' },
				s.characters
			)
				.filter((fit) => fit.misses.length === 0)
				.map((fit) => fit.seatId);
			expect(new Set(twins)).toEqual(
				new Set([s.seat('pithag'), s.seat('witch'), s.seat('nodashii')])
			);
		});

		it('Example 4: Oracle becomes good Demon; evil Demon killed', () => {
			// Wiki: "During the final night, the Pit-Hag turns the Oracle into a good No Dashii. The
			// Storyteller kills the evil Demon only, so that only one Demon is alive during the final
			// day."
			const s = scenario(['pithag', 'oracle', 'chef', 'empath', 'vigormortis'])
				.newDay()
				.becomes('oracle', 'nodashii', 'good')
				.dies('vigormortis');
			expect(s.game.seats[s.seat('oracle')]).toMatchObject({
				characterId: 'nodashii',
				alignment: 'good',
				dead: false
			});
			// A Demon is alive, so the game goes on to the final day.
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
	});
});
