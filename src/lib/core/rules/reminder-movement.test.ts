/**
 * Token integrity: which reminders stay where they were placed. Each character's
 * classification follows its ability on its wiki page (`wikiUrl(character)`); the
 * behaviour tests cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/commands.ts';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { undo } from '#lib/core/engine/log.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import type { Character } from '#lib/core/data/types.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { fixedReminderMove, isFixedReminder, neighbourFollows } from './reminder-movement.ts';

const data = committedGameData();
const movement = [...OFFICIAL_RULES].flatMap(([id, rules]) =>
	rules.reminderMovement ? [[id, rules.reminderMovement] as const] : []
);
/** Official characters with some tokens that stay put: the labels, and why. */
const FIXED_REMINDERS = Object.fromEntries(
	movement.flatMap(([id, m]) => (m.fixed ? [[id, { labels: m.fixed, why: m.why ?? '' }]] : []))
);
/** Official characters whose tokens all move, and why. */
const MOVING_REMINDERS = Object.fromEntries(
	movement.flatMap(([id, m]) => (!m.fixed && m.why !== undefined ? [[id, m.why]] : []))
);
/** Official characters that can carry a fixed token elsewhere, and how. */
const REMINDER_RELOCATORS = Object.fromEntries(
	movement.flatMap(([id, m]) => (m.relocates ? [[id, m.relocates]] : []))
);

describe('coverage', () => {
	it('classifies every official character with reminder tokens exactly once', () => {
		const fixed = Object.keys(FIXED_REMINDERS);
		const moving = Object.keys(MOVING_REMINDERS);
		expect(fixed.filter((id) => moving.includes(id))).toEqual([]);
		const all = new Set([...fixed, ...moving]);
		const withTokens = data.characters.filter(
			(c) => c.reminders.length + c.remindersGlobal.length > 0
		);
		expect(withTokens.filter((c) => !all.has(c.id)).map((c) => c.id)).toEqual([]);
		expect([...all].filter((id) => !withTokens.some((c) => c.id === id))).toEqual([]);
	});

	it('names only tokens the character really has, each with a reason', () => {
		for (const [id, entry] of Object.entries(FIXED_REMINDERS)) {
			const c = data.byId.get(id)!;
			const tokens = [...c.reminders, ...c.remindersGlobal];
			expect(entry.labels.length, id).toBeGreaterThan(0);
			for (const label of entry.labels) expect(tokens, `${id}: ${label}`).toContain(label);
			expect(entry.why.length, id).toBeGreaterThan(0);
		}
		for (const [id, why] of Object.entries(MOVING_REMINDERS))
			expect(why.length, id).toBeGreaterThan(0);
		for (const id of Object.keys(REMINDER_RELOCATORS)) expect(data.byId.has(id), id).toBe(true);
	});
});

describe('isFixedReminder', () => {
	it('keeps start-knowing tokens in place (https://wiki.bloodontheclocktower.com/Washerwoman)', () => {
		expect(isFixedReminder({ characterId: 'washerwoman', label: 'Townsfolk' })).toBe(true);
		expect(isFixedReminder({ characterId: 'washerwoman', label: 'Wrong' })).toBe(true);
	});

	it('keeps the red herring in place (https://wiki.bloodontheclocktower.com/Fortune_Teller)', () => {
		expect(isFixedReminder({ characterId: 'fortuneteller', label: 'Red Herring' })).toBe(true);
	});

	it('lets each-night choices move (https://wiki.bloodontheclocktower.com/Poisoner, /Monk, /Butler)', () => {
		expect(isFixedReminder({ characterId: 'poisoner', label: 'Poisoned' })).toBe(false);
		expect(isFixedReminder({ characterId: 'monk', label: 'Safe' })).toBe(false);
		expect(isFixedReminder({ characterId: 'butler', label: 'Master' })).toBe(false);
	});

	it('lets a character’s other tokens move (https://wiki.bloodontheclocktower.com/Grandmother)', () => {
		expect(isFixedReminder({ characterId: 'grandmother', label: 'Grandchild' })).toBe(true);
		expect(isFixedReminder({ characterId: 'grandmother', label: 'Dead' })).toBe(false);
	});

	it('never fixes homebrew tokens without a rule', () => {
		expect(isFixedReminder({ characterId: 'my-homebrew', label: 'Know' })).toBe(false);
	});

	// A custom character's own `reminderMovement` works as an official one's: the Fortune
	// Teller's red herring is chosen once (https://wiki.bloodontheclocktower.com/Fortune_Teller).
	it('fixes the tokens a custom character’s rule names', () => {
		const seer: Character = {
			...data.byId.get('fortuneteller')!,
			id: 'seer',
			edition: undefined,
			reminders: ['Decoy', 'Seen'],
			rules: parseCharacterRules(
				{ reminderMovement: { fixed: ['Decoy'], why: 'Chosen once at setup.' } },
				'seer',
				new Issues(),
				['Decoy', 'Seen']
			)
		};
		const lookup = new Map([['seer', seer]]);
		expect(isFixedReminder({ characterId: 'seer', label: 'Decoy' }, lookup)).toBe(true);
		expect(isFixedReminder({ characterId: 'seer', label: 'Seen' }, lookup)).toBe(false);
	});

	it('reports a malformed reminderMovement rule', () => {
		const issues = new Issues();
		parseCharacterRules(
			{ reminderMovement: { fixed: ['Red Herring', 'Nope'], moves: true } },
			'rules',
			issues,
			['Red Herring']
		);
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual([
			'rules.reminderMovement.moves',
			'rules.reminderMovement.fixed[1]',
			'rules.reminderMovement.why'
		]);
	});
});

describe('fixedReminderMove', () => {
	function placed(characters: string[], reminder: { characterId: string; label: string }) {
		const { session, ctx, seats } = newGame(characters.length);
		const assign = characters.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		}));
		const s = run(session, ctx, ...assign, { type: 'AddReminder', seatId: seats[1], reminder });
		const reminderId = s.game.seats[seats[1]].reminders[0].reminderId;
		return { s, ctx, seats, reminderId };
	}

	it('warns, but still moves, a fixed token (https://wiki.bloodontheclocktower.com/Fortune_Teller)', () => {
		const { s, ctx, seats, reminderId } = placed(
			['fortuneteller', 'chef', 'imp', 'empath', 'monk'],
			{
				characterId: 'fortuneteller',
				label: 'Red Herring'
			}
		);
		expect(fixedReminderMove(s.game, reminderId, seats[3])).toMatchObject({
			reminder: { characterId: 'fortuneteller', label: 'Red Herring' },
			fromSeatId: seats[1],
			toSeatId: seats[3],
			relocators: []
		});
		const moved = run(s, ctx, { type: 'MoveReminder', reminderId, toSeatId: seats[3] });
		expect(moved.warnings.map((w) => w.code)).toContain('reminder-fixed');
		expect(moved.game.seats[seats[3]].reminders.map((r) => r.reminderId)).toEqual([reminderId]);
	});

	it('does not warn for a moving token or the same seat (https://wiki.bloodontheclocktower.com/Monk)', () => {
		const { s, ctx, seats, reminderId } = placed(['monk', 'chef', 'imp', 'empath', 'slayer'], {
			characterId: 'monk',
			label: 'Safe'
		});
		expect(fixedReminderMove(s.game, reminderId, seats[3])).toBeUndefined();
		expect(fixedReminderMove(s.game, 'missing', seats[3])).toBeUndefined();
		const moved = run(s, ctx, { type: 'MoveReminder', reminderId, toSeatId: seats[3] });
		expect(moved.warnings.map((w) => w.code)).not.toContain('reminder-fixed');
	});

	it('names in-play characters that can legitimately move it (https://wiki.bloodontheclocktower.com/Barber)', () => {
		const { s, seats, reminderId } = placed(['eviltwin', 'chef', 'vigormortis', 'barber', 'monk'], {
			characterId: 'eviltwin',
			label: 'Twin'
		});
		expect(fixedReminderMove(s.game, reminderId, seats[1])).toBeUndefined();
		expect(fixedReminderMove(s.game, reminderId, seats[4])?.relocators).toEqual([
			{ characterId: 'barber', does: REMINDER_RELOCATORS.barber }
		]);
	});
});

describe('tokens after players change seats', () => {
	/** Seats `characters` in order, then puts `label` of `owner` on each of `on`. */
	function seated(characters: string[], owner: string, label: string, on: number[]) {
		const { session, ctx, seats } = newGame(characters.length);
		const commands: Command[] = [
			...characters.map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			...on.map((i): Command => ({
				type: 'AddReminder',
				seatId: seats[i],
				reminder: { characterId: owner, label }
			}))
		];
		return { s: run(session, ctx, ...commands), ctx, seats };
	}
	const holders = (
		game: { seating: string[]; seats: Record<string, { reminders: { label: string }[] }> },
		label: string
	) => game.seating.filter((id) => game.seats[id].reminders.some((r) => r.label === label));

	it('keeps a token on its player, wherever they move (https://wiki.bloodontheclocktower.com/Matron)', () => {
		// The Matron: swapped players take their reminders with them. The Pukka's choice is a
		// player, not a place (https://wiki.bloodontheclocktower.com/Pukka).
		const { s, ctx, seats } = seated(
			['pukka', 'chef', 'baron', 'empath', 'monk'],
			'pukka',
			'Poisoned',
			[1]
		);
		const moved = run(s, ctx, { type: 'SwapSeats', seatA: seats[1], seatB: seats[3] });
		expect(holders(moved.game, 'Poisoned')).toEqual([seats[1]]);
		const again = run(moved, ctx, { type: 'MoveSeat', seatId: seats[1], position: 4 });
		expect(holders(again.game, 'Poisoned')).toEqual([seats[1]]);
		expect(again.warnings.map((w) => w.code)).not.toContain('reminder-followed');
	});

	it("moves the Tea Lady's Cannot Die to her new neighbour (https://wiki.bloodontheclocktower.com/Tea_Lady)", () => {
		const { s, ctx, seats } = seated(
			['tealady', 'chef', 'imp', 'empath', 'monk', 'slayer'],
			'tealady',
			'Cannot Die',
			[1, 5]
		);
		// The Empath swaps with the Chef, so now sits beside the Tea Lady.
		const swapped = run(s, ctx, { type: 'SwapSeats', seatA: seats[1], seatB: seats[3] });
		expect(new Set(holders(swapped.game, 'Cannot Die'))).toEqual(new Set([seats[3], seats[5]]));
		expect(swapped.warnings.find((w) => w.code === 'reminder-followed')?.message).toBe(
			'Tea Lady’s Cannot Die moved from Seat 2 to Seat 4, the new neighbour.'
		);
		// One undo puts the players and the token back.
		expect(holders(undo(swapped).game, 'Cannot Die')).toEqual([seats[1], seats[5]]);
	});

	it('moves both when the Tea Lady herself moves, and leaves a token placed elsewhere', () => {
		const { s, ctx, seats } = seated(
			['tealady', 'chef', 'imp', 'empath', 'monk', 'slayer'],
			'tealady',
			'Cannot Die',
			[1, 5, 2]
		);
		const before = s.game;
		const after = {
			...before,
			seating: [seats[3], seats[1], seats[2], seats[0], seats[4], seats[5]]
		};
		const follows = neighbourFollows(before, after, ctx.characters);
		// Her new neighbours are the Imp (who already has one, placed by hand) and the Monk.
		expect(follows.map((f) => [f.fromSeatId, f.toSeatId])).toEqual([[seats[1], seats[4]]]);
	});

	it("moves the No Dashii's Poisoned to its nearest Townsfolk (https://wiki.bloodontheclocktower.com/No_Dashii)", () => {
		const { s, ctx, seats } = seated(
			['nodashii', 'chef', 'baron', 'empath', 'monk', 'saint'],
			'nodashii',
			'Poisoned',
			[1, 4]
		);
		// The Chef moves away: the Empath is now the nearest Townsfolk clockwise; the Monk stays
		// the nearest anticlockwise past the Saint.
		const moved = run(s, ctx, { type: 'MoveSeat', seatId: seats[1], position: 3 });
		expect(new Set(holders(moved.game, 'Poisoned'))).toEqual(new Set([seats[3], seats[4]]));
	});

	it("leaves the Vigormortis's poisoned neighbour alone (https://wiki.bloodontheclocktower.com/Vigormortis)", () => {
		// The poisoned Townsfolk is chosen once, when the Minion dies.
		const { s, ctx, seats } = seated(
			['vigormortis', 'chef', 'baron', 'empath', 'monk'],
			'vigormortis',
			'Poisoned',
			[3]
		);
		const moved = run(s, ctx, { type: 'MoveSeat', seatId: seats[3], position: 0 });
		expect(holders(moved.game, 'Poisoned')).toEqual([seats[3]]);
	});

	it('only follows tokens that mark neighbours', () => {
		for (const [id, rules] of OFFICIAL_RULES) {
			for (const label of rules.reminderMovement?.followsNeighbours ?? [])
				expect(rules.reminderTargets?.[label]?.neighbour?.of, `${id}: ${label}`).toBe('self');
		}
	});
});
