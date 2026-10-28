/** Commands: bluff sets (decide/bluffs-bag.ts). */
import { describe, expect, it } from 'vitest';
import { newGame, refused, run, warned } from '#lib/core/model/fixtures.test-support.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

describe('bluffs', () => {
	it('sets, replaces and removes bluff sets', () => {
		const { session, ctx } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'SetBluffs', set: 0, characterIds: ['chef', 'empath', 'monk'] },
			{ type: 'SetBluffs', set: 1, characterIds: ['mayor'] },
			{ type: 'SetBluffs', set: 0, characterIds: ['saint', 'empath', 'monk'] }
		);
		expect(s.game.bluffs).toEqual([['saint', 'empath', 'monk'], ['mayor']]);
		expect(refused(s, ctx, { type: 'SetBluffs', set: 3, characterIds: [] })).toBe(
			'invalid-bluff-set'
		);
		const removed = run(s, ctx, { type: 'RemoveBluffSet', set: 0 });
		expect(removed.game.bluffs).toEqual([['mayor']]);
		expect(refused(removed, ctx, { type: 'RemoveBluffSet', set: 1 })).toBe('invalid-bluff-set');
	});

	it("names sets after the Demon's, and names move with their sets", () => {
		const { session, ctx } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'SetBluffs', set: 0, characterIds: ['chef'] },
			{ type: 'SetBluffs', set: 1, characterIds: ['mayor'] },
			{ type: 'SetBluffs', set: 2, characterIds: ['monk'] },
			{ type: 'RenameBluffSet', set: 2, name: '  Legion  ' }
		);
		expect(s.game.bluffNames).toEqual(['', '', 'Legion']);
		// The Demon's set keeps its name; a set that doesn't exist can't be named.
		expect(refused(s, ctx, { type: 'RenameBluffSet', set: 0, name: 'x' })).toBe(
			'invalid-bluff-set'
		);
		expect(refused(s, ctx, { type: 'RenameBluffSet', set: 3, name: 'x' })).toBe(
			'invalid-bluff-set'
		);
		expect(warned(s, ctx, { type: 'RenameBluffSet', set: 2, name: 'Legion' })).toEqual([
			'no-change'
		]);
		const moved = run(s, ctx, { type: 'RemoveBluffSet', set: 1 });
		expect(moved.game.bluffNames).toEqual(['', 'Legion']);
		const cleared = run(moved, ctx, { type: 'RenameBluffSet', set: 1, name: '' });
		expect(cleared.game.bluffNames).toEqual(['', '']);
	});

	it('warns about bluffs in play, evil, repeated, off the script or too many', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' });
		expect(
			warned(s, ctx, {
				type: 'SetBluffs',
				set: 0,
				characterIds: ['chef', 'baron', 'monk', 'monk', 'clockmaker']
			})
		).toEqual([
			'too-many-bluffs',
			'bluff-in-play',
			'bluff-not-good',
			'bluff-duplicate',
			'not-on-script'
		]);
		expect(refused(s, ctx, { type: 'SetBluffs', set: 0, characterIds: ['nope'] })).toBe(
			'unknown-character'
		);
	});

	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk's Townsfolk is not in play.
	it('counts true characters as in play, not a Drunk’s token', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		);
		expect(warned(s, ctx, { type: 'SetBluffs', set: 0, characterIds: ['chef'] })).toEqual([]);
	});

	// Trevor, 2026-10-16: set 1 is the Lunatic's bluffs and may hold characters in play.
	it('lets the Lunatic’s bluffs hold characters in play', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'lunatic' },
			{ type: 'SetBluffs', set: 0, characterIds: ['empath'] }
		);
		expect(warned(s, ctx, { type: 'SetBluffs', set: 1, characterIds: ['chef'] })).toEqual([]);
		expect(warned(s, ctx, { type: 'SetBluffs', set: 0, characterIds: ['chef'] })).toEqual([
			'bluff-in-play'
		]);
	});
});
