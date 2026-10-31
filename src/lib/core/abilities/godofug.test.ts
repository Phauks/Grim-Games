/**
 * God of Ug: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/God_of_Ug
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes God of Ug.
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
	dayReminders(dayStateFromGame(game, (id) => characters.get(id), undefined, characters))
		.groups.flatMap((g) =>
			g.reminders
				.filter((r) => r.characterId === characterId)
				.map((r) => ({ group: g.group, text: renderReminder(r.segments) }))
		);

describe('God of Ug', () => {
	const character = committedCharacter('godofug');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('God of Ug');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Hat']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('godofug')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'vote', name: 'multiplier', value: 2 },
				{ type: 'reminder', name: 'public' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/God_of_Ug#Examples)', () => {
		it.todo('Example 1: Player keeps the hat by speaking simply');
		it.todo('Example 2: Long word passes the hat on');
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/God_of_Ug): the
// Ug hat's effect only lasts through nominations.
describe('God of Ug optional rule', () => {
	const cast = ['chef', 'empath', 'monk', 'poisoner', 'imp'];
	const ug: Command = { type: 'AddRuleCharacter', characterId: 'godofug' };
	const on: Command = { type: 'SetOptionalRule', characterId: 'godofug', on: true };
	const hat = (s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[0],
		reminder: { characterId: 'godofug', label: 'Hat' }
	});

	it('off, the hat is a voting reminder', () => {
		const { game } = castGame(cast, ug, hat);
		expect(linesOf(game, 'godofug').map((l) => l.group)).toEqual(['vote']);
	});

	it('on, the hat is a nominations reminder', () => {
		const { game } = castGame(cast, ug, on, hat);
		expect(linesOf(game, 'godofug').map((l) => l.group)).toEqual(['nomination']);
	});
});
