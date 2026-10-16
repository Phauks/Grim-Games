/**
 * Token integrity: which reminders stay where they were placed. Each character's
 * classification follows its ability on its wiki page (`wikiUrl(character)`); the
 * behaviour tests cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/commands.ts';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	FIXED_REMINDERS,
	MOVING_REMINDERS,
	REMINDER_RELOCATORS,
	fixedReminderMove,
	isFixedReminder
} from './reminder-movement.ts';

const data = committedGameData();

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

	it('never fixes homebrew tokens', () => {
		expect(isFixedReminder({ characterId: 'my-homebrew', label: 'Know' })).toBe(false);
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
