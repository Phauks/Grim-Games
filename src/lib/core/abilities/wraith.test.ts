/**
 * Wraith: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Wraith
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Wraith.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { nightOrder } from '#lib/core/rules/night-order.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
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

describe('Wraith', () => {
	const character = committedCharacter('wraith');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Wraith');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('wraith')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'player', name: 'open-eyes', time: 'night' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Wraith#Examples)', () => {
		it('Example 1: Wraith signals to kill suspected Fortune Teller', () => {
			// Wiki: "During the first night the Wraith peeks at other players, and notices which good
			// players wake and which do not. During the second night, the Wraith opens their eyes more
			// fully and notices that Doug was woken and pointed to two players tonight. During the 3rd
			// night, when both the Wraith and the Demon wake together, the Wraith uses body language
			// and points to the character sheet to communicate to the Demon to kill Doug, whom the
			// Wraith believes is the Fortune Teller."
			const s = scenario(['wraith', 'fortuneteller', 'chef', 'empath', 'imp']).newDay().newDay();
			const steps = nightOrder({
				night: 'other',
				sheet: committedGameData().nightSheet,
				players: s.game.seating.length,
				inPlay: ['wraith', 'fortuneteller', 'chef', 'empath', 'imp'].map((id) =>
					s.characters.get(id)!
				)
			}).steps;
			const ids = steps.map((step) => step.id);
			expect(ids).toContain('wraith');
			// The Demon's step says to wake the Wraith too; a good player's step does not.
			expect(steps.find((step) => step.id === 'imp')?.notes.join(' ')).toMatch(/Wraith/);
			expect(steps.find((step) => step.id === 'fortuneteller')?.notes.join(' ')).not.toMatch(
				/Wraith/
			);
		});
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Wraith): once a
// game, a player who is mad that the Wraith's player is the Wraith may die (Trevor, 2026-10-31:
// "you" is the Wraith's player).
describe('Wraith optional rule', () => {
	const cast = ['chef', 'empath', 'monk', 'wraith', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'wraith', on: true };

	it('off, no day reminder', () => {
		const { game } = castGame(cast);
		expect(linesOf(game, 'wraith')).toEqual([]);
	});

	it('on, a madness reminder', () => {
		const { game } = castGame(cast, on);
		expect(linesOf(game, 'wraith').map((l) => l.group)).toEqual(['madness']);
	});
});
