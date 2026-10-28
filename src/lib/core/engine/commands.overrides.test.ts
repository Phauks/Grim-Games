/** Commands: night-order and day-reminder overrides (decide/overrides.ts). */
import { describe, expect, it } from 'vitest';
import {
	newGame,
	refused,
	run,
	testCharacters,
	warned
} from '#lib/core/model/fixtures.test-support.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/index.ts';
import type { Command } from './commands.ts';
import { redo, undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

describe('night-order overrides', () => {
	it('adds, inserts, replaces and removes overrides in order, with undo', () => {
		const { session, ctx } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddNightStepOverride', override: { kind: 'hide', id: 'chef', night: 'first' } },
			{
				type: 'AddNightStepOverride',
				override: {
					kind: 'add',
					id: 'custom-1',
					text: '  Check the house rule  ',
					title: ' House rule ',
					characterId: 'imp',
					after: null
				}
			},
			{
				type: 'AddNightStepOverride',
				index: 0,
				override: { kind: 'move', id: 'monk', after: 'poisoner' }
			}
		);
		expect(s.game.nightOrderOverrides).toEqual([
			{ kind: 'move', id: 'monk', after: 'poisoner' },
			{ kind: 'hide', id: 'chef', night: 'first' },
			{
				kind: 'add',
				id: 'custom-1',
				text: '  Check the house rule  ',
				title: 'House rule',
				characterId: 'imp',
				after: null
			}
		]);
		const replaced = run(s, ctx, {
			type: 'ReplaceNightStepOverride',
			index: 1,
			override: { kind: 'edit', id: 'chef', text: 'Show a number' }
		});
		expect(replaced.game.nightOrderOverrides[1]).toEqual({
			kind: 'edit',
			id: 'chef',
			text: 'Show a number'
		});
		const removed = run(replaced, ctx, { type: 'RemoveNightStepOverride', index: 0 });
		expect(removed.game.nightOrderOverrides.map((o) => o.kind)).toEqual(['edit', 'add']);
		expect(undo(removed).game).toEqual(replaced.game);
		expect(undo(undo(removed)).game).toEqual(s.game);
		expect(redo(undo(removed)).game).toEqual(removed.game);
		expect(undo(undo(undo(undo(undo(removed))))).game.nightOrderOverrides).toEqual([]);
	});

	it('refuses bad indexes and malformed overrides', () => {
		const { session, ctx } = newGame(names);
		const hide = { kind: 'hide', id: 'chef' } as const;
		expect(refused(session, ctx, { type: 'RemoveNightStepOverride', index: 0 })).toBe(
			'invalid-position'
		);
		expect(
			refused(session, ctx, { type: 'ReplaceNightStepOverride', index: 0, override: hide })
		).toBe('invalid-position');
		expect(refused(session, ctx, { type: 'AddNightStepOverride', index: 1, override: hide })).toBe(
			'invalid-position'
		);
		for (const override of [
			{ kind: 'hide', id: '' },
			{ kind: 'hide', id: 'chef', night: 'third' },
			{ kind: 'edit', id: 'chef' },
			{ kind: 'move', id: 'chef', after: '' },
			{ kind: 'wobble', id: 'chef' }
		]) {
			expect(refused(session, ctx, { type: 'AddNightStepOverride', override } as Command)).toBe(
				'invalid-override'
			);
		}
		expect(
			refused(session, ctx, {
				type: 'AddNightStepOverride',
				override: { kind: 'add', id: 'x', text: 'x', characterId: 'nope', after: null }
			})
		).toBe('unknown-character');
	});

	it('warns about a reused id, and about replacing with the same override', () => {
		const { session, ctx } = newGame(names);
		const add = { kind: 'add', id: 'x', text: 'Wake X', after: null } as const;
		const s = run(session, ctx, { type: 'AddNightStepOverride', override: add });
		expect(warned(s, ctx, { type: 'AddNightStepOverride', override: add })).toEqual([
			'duplicate-override'
		]);
		expect(warned(s, ctx, { type: 'ReplaceNightStepOverride', index: 0, override: add })).toEqual([
			'no-change'
		]);
	});
});

describe('day-reminder overrides', () => {
	it('adds, replaces and removes overrides, with undo', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddDayReminderOverride', override: { kind: 'hide', key: 'saint#0@x' } },
			{
				type: 'AddDayReminderOverride',
				override: {
					kind: 'add',
					key: 'custom-1',
					group: 'vote',
					text: 'votes twice',
					seatId: seats[0]
				}
			}
		);
		expect(s.game.dayReminderOverrides).toEqual([
			{ kind: 'hide', key: 'saint#0@x' },
			{ kind: 'add', key: 'custom-1', group: 'vote', text: 'votes twice', seatId: seats[0] }
		]);
		const replaced = run(s, ctx, {
			type: 'ReplaceDayReminderOverride',
			index: 0,
			override: { kind: 'edit', key: 'saint#0@x', text: 'is still alive' }
		});
		const removed = run(replaced, ctx, { type: 'RemoveDayReminderOverride', index: 1 });
		expect(removed.game.dayReminderOverrides).toEqual([
			{ kind: 'edit', key: 'saint#0@x', text: 'is still alive' }
		]);
		expect(undo(removed).game).toEqual(replaced.game);
		expect(undo(undo(removed)).game).toEqual(s.game);
		expect(redo(undo(removed)).game).toEqual(removed.game);
	});

	it('reach the pre-day reminders, with the recorded causes of death', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'saint' },
			{ type: 'SetDead', seatId: seats[0], dead: true, cause: 'execution' },
			{
				type: 'AddDayReminderOverride',
				override: { kind: 'add', key: 'custom-1', group: 'announcement', text: 'House rule' }
			}
		);
		const state = dayStateFromGame(s.game, (id) => testCharacters.get(id));
		expect(state.overrides).toEqual(s.game.dayReminderOverrides);
		expect(state.seats[0].deathCause).toBe('execution');
		const lines = dayReminders(state).groups.flatMap((g) =>
			g.reminders.map((r) => renderReminder(r.segments))
		);
		expect(lines).toContain('House rule');
		// An explicit list still wins over the stored one.
		expect(dayStateFromGame(s.game, (id) => testCharacters.get(id), []).overrides).toEqual([]);
	});

	it('refuses unknown groups, seats and characters', () => {
		const { session, ctx } = newGame(names);
		const add = (extra: object) =>
			({
				type: 'AddDayReminderOverride',
				override: { kind: 'add', key: 'k', group: 'vote', text: 't', ...extra }
			}) as Command;
		expect(refused(session, ctx, add({ group: 'nope' }))).toBe('invalid-override');
		expect(refused(session, ctx, add({ key: ' ' }))).toBe('invalid-override');
		expect(refused(session, ctx, add({ seatId: 'nobody' }))).toBe('unknown-seat');
		expect(refused(session, ctx, add({ characterId: 'nope' }))).toBe('unknown-character');
		expect(refused(session, ctx, { type: 'RemoveDayReminderOverride', index: 0 })).toBe(
			'invalid-position'
		);
	});
});
