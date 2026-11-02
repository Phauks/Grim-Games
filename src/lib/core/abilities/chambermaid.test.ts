/**
 * Chambermaid: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Chambermaid
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Chambermaid.
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
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import type { Night } from '#lib/core/rules/night-order.ts';
import { infoPicker, isAllowed } from '#lib/core/rules/night-info/picker.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';

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
		/** The number the Chambermaid learns for two players tonight, from the grimoire. */
		const learns = (s: Scenario, night: Night, a: SeatRef, b: SeatRef) => {
			const picker = infoPicker(s.game, s.seat('chambermaid'), 'chambermaid', s.characters, night)!;
			const pair: SeatId[] = [s.seat(a), s.seat(b)];
			return picker.options.find(
				(o) => o.seats.length === 2 && pair.every((id) => o.seats.includes(id))
			)?.number;
		};

		it.fails('Example 1: Reads two, then zero: Exorcist woke Shabaloth', () => {
			// Wiki: "The Chambermaid chooses the Exorcist and the Innkeeper, and learns a "2." The
			// next night, the Exorcist chooses the Shabaloth, which will wake the Shabaloth. Later,
			// Chambermaid chooses the Shabaloth and the Fool. Since the Shabaloth only woke due to the
			// Exorcist ability, the Chambermaid learns a "0"."
			// Waits on the engine: a Demon the Exorcist chose still counts as woken by its own
			// ability (wokeTonight does not read the Exorcist's stopsWaking token).
			const s = scenario(['chambermaid', 'exorcist', 'innkeeper', 'fool', 'shabaloth', 'goon'])
				.newDay()
				.newDay();
			expect(learns(s, 'other', 'exorcist', 'innkeeper')).toBe(2);
			const next = s.newDay().reminder('shabaloth', 'exorcist', 'Chosen');
			expect(learns(next, 'other', 'shabaloth', 'fool')).toBe(0);
		});
		it("Example 2: Drunk Chambermaid's reading of two is wrong", () => {
			// Wiki: "It is the second night. The Chambermaid chooses the Grandmother and the evil
			// Goon, and learns a "2." Only the Goon will wake tonight, but the Chambermaid is drunk."
			const s = scenario(['chambermaid', 'grandmother', 'goon', 'chef', 'imp'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('goon'), alignment: 'evil' }))
				.newDay()
				.drunk('chambermaid');
			const picker = infoPicker(
				s.game,
				s.seat('chambermaid'),
				'chambermaid',
				s.characters,
				'other'
			)!;
			const choice = { seats: [s.seat('grandmother'), s.seat('goon')], number: 2 };
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, choice)).toBe(true);
			expect(learns(s, 'other', 'grandmother', 'goon')).not.toBe(2);
		});
		it.fails("Example 3: Assassin's idle wake counts; Gossip stays hidden", () => {
			// Wiki: "It is the first night. The Chambermaid chooses the Assassin and the Moonchild,
			// and learns a "0" because the Assassin does not wake to use their ability on the first
			// night. The next night, they choose the Assassin and the Gossip. The Assassin woke but
			// did not use their ability. The Gossip ability is used, but the Gossip does not wake to
			// use it. The Chambermaid learns a "1"."
			// Waits on the engine: the Gossip's night step (the Storyteller's, not a wake) counts as
			// the Gossip waking.
			const s = scenario(['chambermaid', 'assassin', 'moonchild', 'gossip', 'imp']);
			expect(learns(s, 'first', 'assassin', 'moonchild')).toBe(0);
			const next = s.newDay();
			expect(learns(next, 'other', 'assassin', 'gossip')).toBe(1);
		});
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
