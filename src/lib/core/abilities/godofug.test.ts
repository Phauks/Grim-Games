/**
 * God of Ug: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/God_of_Ug
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes God of Ug.
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
import { scenario } from '#lib/core/testing/scenario.ts';

/** This character's day reminders: their group and plain text. */
const linesOf = (game: Game, characterId: string) =>
	dayReminders(
		dayStateFromGame(game, (id) => characters.get(id), undefined, characters)
	).groups.flatMap((g) =>
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
		it('Example 1: Player keeps the hat by speaking simply', () => {
			// Wiki: "Amy is wearing the Ug hat. When nominated, she says, “It not me. I think Ben
			// has been the talk with the bad guy. He bad.” Amy keeps the Ug hat."
			// Whether the wearer spoke simply is the Storyteller's call; the hat stays where it is.
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('godofug')
				.reminder('chef', 'godofug', 'Hat');
			expect(linesOf(s.game, 'godofug')).toEqual([
				{ group: 'vote', text: expect.stringContaining('Ana') }
			]);
			expect(linesOf(s.nominate('empath', 'chef').game, 'godofug')).toEqual(
				linesOf(s.game, 'godofug')
			);
		});
		it('Example 2: Long word passes the hat on', () => {
			// Wiki: "Lewis has the Ug hat. In a private conversation with Julian and Alex, Lewis
			// says, “I think that you are both good. I am the bird thing that can see one guy when
			// I die. I want the Demon to kill me so that I get the guy and know things to tell you
			// in the day that is next.” The Storyteller gives Abdallah the Ug hat, because “Demon”
			// is a multisyllabic word."
			// The Storyteller moves the hat to another player, and the day panel follows it.
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('godofug')
				.reminder('chef', 'godofug', 'Hat');
			const moved = s.do((at) => ({
				type: 'MoveReminder',
				reminderId: at.game.seats[at.seat('chef')].reminders[0].reminderId,
				toSeatId: at.seat('empath')
			}));
			expect(linesOf(moved.game, 'godofug')).toEqual([
				{ group: 'vote', text: expect.stringContaining('Ben') }
			]);
			expect(moved.game.seats[moved.seat('chef')].reminders).toEqual([]);
		});
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
