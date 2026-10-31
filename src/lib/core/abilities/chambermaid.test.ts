/**
 * Chambermaid: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Chambermaid
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Chambermaid.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker } from '#lib/core/rules/night-info/picker.ts';

describe('Chambermaid', () => {
	const character = committedCharacter('chambermaid');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Chambermaid');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('chambermaid')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Chambermaid#Examples)', () => {
		it.todo('Example 1: Reads two, then zero: Exorcist woke Shabaloth');
		it.todo("Example 2: Drunk Chambermaid's reading of two is wrong");
		it.todo("Example 3: Assassin's idle wake counts; Gossip stays hidden");
	});
});

// https://wiki.bloodontheclocktower.com/Chambermaid: two alive players (not the Chambermaid);
// the number of them who woke tonight because of their own ability. A player woken to be asked
// counts even if they decline (Trevor, 2026-10-31).
describe('Chambermaid info', () => {
	const cast = ['chambermaid', 'chef', 'empath', 'seamstress', 'poisoner', 'imp'];
	const numberFor = (cmds: ((s: string[]) => Command)[], pair: [number, number]) => {
		const { game, seats } = castGame(cast, ...cmds);
		const picker = infoPicker(game, seats[0], 'chambermaid', characters, 'other');
		const option = picker?.options.find(
			(o) => o.seats.length === 2 && pair.every((i) => o.seats.includes(seats[i]))
		);
		return option?.number;
	};
	const used = (s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[3],
		reminder: { characterId: 'seamstress', label: 'No Ability' }
	});

	it('counts a player whose character wakes on other nights, not one who does not', () => {
		expect(numberFor([], [1, 2])).toBe(1);
		expect(numberFor([], [2, 4])).toBe(2);
	});

	it('counts a Seamstress asked whether to use their ability, until it is used', () => {
		expect(numberFor([], [1, 3])).toBe(1);
		expect(numberFor([used], [1, 3])).toBe(0);
	});

	it('leaves out dead players and the Chambermaid', () => {
		const { game, seats } = castGame(cast, (s) => ({
			type: 'SetDead',
			seatId: s[2],
			dead: true,
			cause: 'demon'
		}));
		const picker = infoPicker(game, seats[0], 'chambermaid', characters, 'other');
		const chosen = new Set(picker?.options.flatMap((o) => o.seats));
		expect(chosen.has(seats[0])).toBe(false);
		expect(chosen.has(seats[2])).toBe(false);
	});
});
