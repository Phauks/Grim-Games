/**
 * Alsaahir: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Alsaahir
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Alsaahir.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import type { Game } from '#lib/core/model/types.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';

/** This character's day reminders: their group and plain text. */
const linesOf = (game: Game, characterId: string) =>
	dayReminders(
		dayStateFromGame(game, (id) => characters.get(id), undefined, characters)
	).groups.flatMap((g) =>
		g.reminders
			.filter((r) => r.characterId === characterId)
			.map((r) => ({ group: g.group, text: renderReminder(r.segments) }))
	);

describe('Alsaahir', () => {
	const character = committedCharacter('alsaahir');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Alsaahir');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('alsaahir')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Alsaahir#Examples)', () => {
		it.todo('Example 1: Guessing four good players changes nothing');
		it.todo('Example 2: Correct guess of all evil players wins');
		it.todo('Example 3: Drunk guess fails, sober guess fails too');
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Alsaahir): the
// Storyteller may let only three players make the guess each day.
describe('Alsaahir optional rule', () => {
	const cast = ['alsaahir', 'chef', 'empath', 'monk', 'poisoner', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'alsaahir', on: true };

	it('off, the reminder sets no limit', () => {
		const { game } = castGame(cast);
		expect(
			linesOf(game, 'alsaahir')
				.map((l) => l.text)
				.join()
		).not.toContain('three');
	});

	it('on, the reminder says three players a day', () => {
		const { game } = castGame(cast, on);
		expect(
			linesOf(game, 'alsaahir')
				.map((l) => l.text)
				.join()
		).toContain('three players');
	});
});
