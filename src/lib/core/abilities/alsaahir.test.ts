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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import type { Game } from '#lib/core/model/types.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { endCharacters } from '#lib/core/rules/end-reason.ts';
import { gameEnds, promptable } from '#lib/core/rules/game-end.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

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
		it('Example 1: Guessing four good players changes nothing', () => {
			// Wiki: "The Alsaahir guesses four good players. Nothing happens."
			const s = scenario(['alsaahir', 'chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp']);
			expect(promptable(gameEnds(s.game, s.characters))).toEqual([]);
		});

		it.fails('Example 2: Correct guess of all evil players wins', () => {
			// Wiki: "The Alsaahir guesses that Doug is the Demon, and Ben and Sarah are Minions. Doug is the
			// Demon, and Ben and Sarah are Minions. Good wins immediately."
			const s = scenario(['alsaahir', 'poisoner', 'chef', 'imp', 'empath', 'spy', 'monk']);
			// End game offers the Alsaahir as the reason, for the Storyteller to pick.
			expect(endCharacters(s.game, s.characters)).toContain('alsaahir');
			engineGap(
				'unplanned',
				'a recorded Alsaahir guess that names every Demon and Minion ends the game, and good wins'
			);
		});

		it('Example 3: Drunk guess fails, sober guess fails too', () => {
			// Wiki: "The drunk Alsaahir guesses that Doug is the Demon, and Ben and Sarah are Minions. Doug is
			// the Demon, and Ben and Sarah are Minions. Nothing happens and the game continues. The next day,
			// the sober Alsaahir guesses that Ben is the Demon and Doug and Sarah are Minions. Nothing happens
			// and the game continues."
			const s = scenario(['alsaahir', 'poisoner', 'chef', 'imp', 'empath', 'spy', 'monk']);
			const drunk = s.reminder('alsaahir', 'sweetheart', 'Drunk');
			expect(abilityState(drunk.game, drunk.seat('alsaahir'), drunk.characters).works).toBe(false);
			expect(promptable(gameEnds(drunk.game, drunk.characters))).toEqual([]);
			const sober = s.newDay();
			expect(abilityState(sober.game, sober.seat('alsaahir'), sober.characters).works).toBe(true);
			expect(promptable(gameEnds(sober.game, sober.characters))).toEqual([]);
		});
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
