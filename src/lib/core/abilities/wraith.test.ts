/**
 * Wraith: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Wraith
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Wraith.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
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
		it.todo('Example 1: Wraith signals to kill suspected Fortune Teller');
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Wraith): once a
// game, a player mad about being the Wraith may die.
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
