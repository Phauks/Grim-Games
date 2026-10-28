/** Commands: characters, alignment, death, overrides and rule characters (decide/characters.ts). */
import { describe, expect, it } from 'vitest';
import { codes, newGame, refused, run, warned } from '#lib/core/model/fixtures.test-support.ts';
import { dispatch, redo, undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

describe('AssignCharacter and alignment', () => {
	it('defaults alignment from the character type', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'saint' },
			{ type: 'AssignCharacter', seatId: seats[2], characterId: 'baron' },
			{ type: 'AssignCharacter', seatId: seats[3], characterId: 'imp' }
		);
		expect(seats.slice(0, 4).map((id) => s.game.seats[id].alignment)).toEqual([
			'good',
			'good',
			'evil',
			'evil'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Travellers: the Storyteller chooses a
	// Traveller's alignment, often not straight away (Trevor, 2026-10-16).
	it('lets a Traveller wait for its alignment', () => {
		const { session, ctx, seats } = newGame(names);
		const unset = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'beggar'
		});
		expect(unset.game.seats[seats[0]].characterId).toBe('beggar');
		expect(unset.game.seats[seats[0]]).not.toHaveProperty('alignment');
		const s = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'beggar',
			alignment: 'evil'
		});
		expect(s.game.seats[seats[0]].alignment).toBe('evil');
		// A Traveller does not need to be on the script.
		expect(s.warnings).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/States: a character change does not change
	// alignment.
	it('keeps the alignment when a seat changes character, unless one is given', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{ type: 'SetAlignment', seatId: seats[0], alignment: 'evil' }
		);
		const changed = dispatch(
			s,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'empath' },
			ctx
		);
		if (!changed.ok) throw new Error();
		expect(changed.session.game.seats[seats[0]].alignment).toBe('evil');
		expect(codes(changed)).toEqual(['kept-alignment']);
		const explicit = run(s, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'imp',
			alignment: 'good'
		});
		expect(explicit.game.seats[seats[0]].alignment).toBe('good');
		// A Traveller on a seat that already has an alignment keeps it.
		const traveller = run(s, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'beggar'
		});
		expect(traveller.game.seats[seats[0]].alignment).toBe('evil');
	});

	it('warns about characters off the script or already on another seat', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' });
		expect(
			warned(s, ctx, { type: 'AssignCharacter', seatId: seats[1], characterId: 'chef' })
		).toEqual(['already-in-play']);
		expect(
			warned(s, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' })
		).toEqual([]);
		expect(
			warned(s, ctx, { type: 'AssignCharacter', seatId: seats[1], characterId: 'clockmaker' })
		).toEqual(['not-on-script']);
		// Legion can be in play more than once (TPI `bag-duplicate`).
		const legion = run(s, ctx, {
			type: 'AssignCharacter',
			seatId: seats[1],
			characterId: 'legion'
		});
		expect(
			warned(legion, ctx, { type: 'AssignCharacter', seatId: seats[2], characterId: 'legion' })
		).toEqual([]);
	});

	it('never puts a Fabled or Loric on a seat, and refuses unknown characters and seats', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			refused(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'djinn' })
		).toBe('not-seatable');
		expect(
			refused(session, ctx, {
				type: 'AssignCharacter',
				seatId: seats[0],
				characterId: 'bootlegger'
			})
		).toBe('not-seatable');
		expect(
			refused(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'nope' })
		).toBe('unknown-character');
		expect(
			refused(session, ctx, { type: 'AssignCharacter', seatId: 'x', characterId: 'chef' })
		).toBe('unknown-seat');
	});

	it('clears a character and its alignment', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
			{ type: 'ClearCharacter', seatId: seats[0] }
		);
		expect('characterId' in s.game.seats[seats[0]]).toBe(false);
		expect('alignment' in s.game.seats[seats[0]]).toBe(false);
		expect(warned(s, ctx, { type: 'ClearCharacter', seatId: seats[0] })).toEqual(['no-change']);
	});

	it('sets alignment, and setting the same alignment is a no-op', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{ type: 'SetAlignment', seatId: seats[0], alignment: 'evil' }
		);
		expect(s.game.seats[seats[0]].alignment).toBe('evil');
		expect(warned(s, ctx, { type: 'SetAlignment', seatId: seats[0], alignment: 'evil' })).toEqual([
			'no-change'
		]);
	});
});

describe('death and ghost votes', () => {
	it('marks death, and a player who comes back gets their vote back', () => {
		const { session, ctx, seats } = newGame(names);
		const dead = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true },
			{ type: 'SpendGhostVote', seatId: seats[0] }
		);
		expect(dead.game.seats[seats[0]]).toMatchObject({ dead: true, ghostVoteUsed: true });
		const revived = dispatch(dead, { type: 'SetDead', seatId: seats[0], dead: false }, ctx);
		if (!revived.ok) throw new Error();
		expect(revived.session.game.seats[seats[0]]).toMatchObject({
			dead: false,
			ghostVoteUsed: false
		});
		expect(revived.session.log.entries.at(-1)?.events.map((e) => e.type)).toEqual([
			'DeathSet',
			'GhostVoteRestored'
		]);
		expect(warned(dead, ctx, { type: 'SetDead', seatId: seats[0], dead: true })).toEqual([
			'no-change'
		]);
		expect(warned(session, ctx, { type: 'SetDead', seatId: seats[0], dead: false })).toEqual([
			'no-change'
		]);
	});

	it('warns when a death has no cause, but still records it (Trevor, 2026-10-16)', () => {
		const { session, ctx, seats } = newGame(names);
		expect(warned(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true })).toEqual([
			'no-cause'
		]);
		expect(
			warned(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true, cause: 'demon' })
		).toEqual([]);
	});

	it('warns when a living player spends a ghost vote, but lets the Storyteller do it', () => {
		const { session, ctx, seats } = newGame(names);
		const result = dispatch(session, { type: 'SpendGhostVote', seatId: seats[0] }, ctx);
		if (!result.ok) throw new Error();
		expect(codes(result)).toEqual(['ghost-vote-while-alive']);
		expect(result.session.game.seats[seats[0]].ghostVoteUsed).toBe(true);
		expect(warned(result.session, ctx, { type: 'SpendGhostVote', seatId: seats[0] })).toEqual([
			'no-change'
		]);
		const restored = run(result.session, ctx, { type: 'RestoreGhostVote', seatId: seats[0] });
		expect(restored.game.seats[seats[0]].ghostVoteUsed).toBe(false);
		expect(warned(restored, ctx, { type: 'RestoreGhostVote', seatId: seats[0] })).toEqual([
			'no-change'
		]);
	});

	it('lets a Zombuul that registers as dead spend a ghost vote without a warning', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'zombuul' },
			{ type: 'AddReminder', seatId: seats[0], reminder: { characterId: 'zombuul', label: 'Dead' } }
		);
		expect(warned(s, ctx, { type: 'SpendGhostVote', seatId: seats[0] })).toEqual([]);
	});
});

describe('Storyteller overrides', () => {
	it('sets one override per field, trims notes, and clears them', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{
				type: 'SetOverride',
				seatId: seats[0],
				override: { field: 'canDie', value: false, note: ' ' }
			},
			{
				type: 'SetOverride',
				seatId: seats[0],
				override: { field: 'canDie', value: true, note: ' Tea Lady misread ' }
			},
			{ type: 'SetOverride', seatId: seats[0], override: { field: 'alignment', value: 'evil' } }
		);
		expect(s.game.seats[seats[0]].overrides).toEqual([
			{ field: 'canDie', value: true, note: 'Tea Lady misread' },
			{ field: 'alignment', value: 'evil' }
		]);
		const cleared = run(s, ctx, { type: 'ClearOverride', seatId: seats[0], field: 'canDie' });
		expect(cleared.game.seats[seats[0]].overrides).toEqual([{ field: 'alignment', value: 'evil' }]);
		expect(
			warned(cleared, ctx, { type: 'ClearOverride', seatId: seats[0], field: 'canDie' })
		).toEqual(['no-change']);
	});

	it('refuses a character override for an unknown character, or an unknown field', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			refused(session, ctx, {
				type: 'SetOverride',
				seatId: seats[0],
				override: { field: 'character', value: 'nope' }
			})
		).toBe('unknown-character');
		expect(
			refused(session, ctx, {
				type: 'SetOverride',
				seatId: seats[0],
				override: { field: 'nonsense', value: true } as never
			})
		).toBe('unknown-override');
	});
});

describe('rule characters', () => {
	// https://wiki.bloodontheclocktower.com/Fabled and /Loric: they change the rules and
	// are never a player's character.
	it('adds and removes Fabled and Loric only', () => {
		const { session, ctx } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'djinn' },
			{ type: 'AddRuleCharacter', characterId: 'bootlegger' }
		);
		expect(s.game.ruleCharacters).toEqual(['djinn', 'bootlegger']);
		expect(Object.values(s.game.seats).every((seat) => seat.characterId === undefined)).toBe(true);
		expect(warned(s, ctx, { type: 'AddRuleCharacter', characterId: 'djinn' })).toEqual([
			'no-change'
		]);
		expect(refused(s, ctx, { type: 'AddRuleCharacter', characterId: 'imp' })).toBe(
			'not-rule-character'
		);
		const removed = run(s, ctx, { type: 'RemoveRuleCharacter', characterId: 'djinn' });
		expect(removed.game.ruleCharacters).toEqual(['bootlegger']);
		expect(warned(removed, ctx, { type: 'RemoveRuleCharacter', characterId: 'djinn' })).toEqual([
			'no-change'
		]);
	});
});

describe('cause of death', () => {
	it('marks a player dead with an optional cause, and coming back clears it', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true, cause: 'execution' },
			{ type: 'SetDead', seatId: seats[1], dead: true, cause: 'imp' },
			{ type: 'SetDead', seatId: seats[2], dead: true }
		);
		expect(s.game.seats[seats[0]]).toMatchObject({ dead: true, deathCause: 'execution' });
		expect(s.game.seats[seats[1]]).toMatchObject({ dead: true, deathCause: 'imp' });
		expect('deathCause' in s.game.seats[seats[2]]).toBe(false);
		const revived = run(s, ctx, { type: 'SetDead', seatId: seats[0], dead: false });
		expect(revived.game.seats[seats[0]]).toEqual({
			seatId: seats[0],
			playerName: 'Ana',
			dead: false,
			ghostVoteUsed: false,
			overrides: [],
			reminders: []
		});
	});

	it('records, changes and clears the cause later, with undo and redo', () => {
		const { session, ctx, seats } = newGame(names);
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true });
		const set = run(dead, ctx, { type: 'SetDeathCause', seatId: seats[0], cause: 'demon' });
		expect(set.game.seats[seats[0]].deathCause).toBe('demon');
		const changed = run(set, ctx, { type: 'SetDeathCause', seatId: seats[0], cause: 'slayer' });
		expect(changed.game.seats[seats[0]].deathCause).toBe('slayer');
		const cleared = run(changed, ctx, { type: 'SetDeathCause', seatId: seats[0] });
		expect('deathCause' in cleared.game.seats[seats[0]]).toBe(false);

		const back = undo(cleared);
		expect(back.game.seats[seats[0]].deathCause).toBe('slayer');
		expect(undo(undo(back)).game.seats[seats[0]].deathCause).toBeUndefined();
		expect(redo(undo(back)).game).toEqual(back.game);
		expect(redo(back).game).toEqual(cleared.game);
	});

	it('undoing a revival brings the cause back', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true, cause: 'other' },
			{ type: 'SetDead', seatId: seats[0], dead: false }
		);
		expect(s.game.seats[seats[0]].deathCause).toBeUndefined();
		expect(undo(s).game.seats[seats[0]]).toMatchObject({ dead: true, deathCause: 'other' });
	});

	it('sets the cause when an already dead player is marked dead with one', () => {
		const { session, ctx, seats } = newGame(names);
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true });
		const result = dispatch(
			dead,
			{ type: 'SetDead', seatId: seats[0], dead: true, cause: 'execution' },
			ctx
		);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.session.log.entries.at(-1)?.events).toEqual([
			{ type: 'DeathCauseSet', seatId: seats[0], cause: 'execution' }
		]);
		expect(
			warned(result.session, ctx, {
				type: 'SetDead',
				seatId: seats[0],
				dead: true,
				cause: 'execution'
			})
		).toEqual(['no-change']);
	});

	it('refuses an unknown character as a cause, and a cause for a living player', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			refused(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true, cause: 'nope' })
		).toBe('unknown-character');
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true });
		expect(refused(dead, ctx, { type: 'SetDeathCause', seatId: seats[0], cause: 'nope' })).toBe(
			'unknown-character'
		);
		expect(refused(session, ctx, { type: 'SetDeathCause', seatId: seats[1], cause: 'demon' })).toBe(
			'not-dead'
		);
		expect(refused(session, ctx, { type: 'SetDeathCause', seatId: 'nobody' })).toBe('unknown-seat');
		expect(warned(dead, ctx, { type: 'SetDeathCause', seatId: seats[0] })).toEqual(['no-change']);
	});

	it('ignores a cause when bringing a player back, with a warning', () => {
		const { session, ctx, seats } = newGame(names);
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[0], dead: true });
		const result = dispatch(
			dead,
			{ type: 'SetDead', seatId: seats[0], dead: false, cause: 'execution' },
			ctx
		);
		if (!result.ok) throw new Error(result.error.message);
		expect(codes(result)).toEqual(['cause-ignored']);
		expect(result.session.game.seats[seats[0]]).toMatchObject({ dead: false });
		expect(result.session.game.seats[seats[0]].deathCause).toBeUndefined();
	});
});
