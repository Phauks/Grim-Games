import { describe, expect, it } from 'vitest';
import { newGame, run, testContext, testScript } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from './commands.ts';
import { decide } from './decide.ts';
import { createGame, dispatch, type GameSession } from './log.ts';
import type { EngineContext } from './context.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

function codes(decision: { warnings: { code: string }[] }): string[] {
	return decision.warnings.map((w) => w.code);
}

function refused(session: GameSession, ctx: EngineContext, command: Command): string {
	const result = dispatch(session, command, ctx);
	if (result.ok) throw new Error(`${command.type} was accepted`);
	return result.error.code;
}

function warned(session: GameSession, ctx: EngineContext, command: Command): string[] {
	const result = dispatch(session, command, ctx);
	if (!result.ok) throw new Error(`${command.type} refused: ${result.error.message}`);
	return codes(result);
}

describe('CreateGame', () => {
	it('creates empty seats in order with injected ids and time', () => {
		const ctx = testContext();
		const result = createGame({ type: 'CreateGame', script: testScript, playerCount: 7 }, ctx);
		if (!result.ok) throw new Error(result.error.message);
		const { game } = result.session;
		expect(game.seating).toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6', 'id-7']);
		expect(game.gameId).toBe('id-8');
		expect(game.createdAt).toBe(Date.UTC(2026, 9, 15) + 1000);
		expect(game.seats['id-1']).toEqual({
			seatId: 'id-1',
			dead: false,
			ghostVoteUsed: false,
			overrides: [],
			reminders: []
		});
		expect(game.script).toBe(testScript);
		expect(game.ruleCharacters).toEqual([]);
		expect(game.bluffs).toEqual([]);
		expect(game.bag).toBeUndefined();
		expect(result.warnings).toEqual([]);
	});

	it('warns outside 5 to 15 players and refuses impossible counts', () => {
		const ctx = testContext();
		const small = createGame({ type: 'CreateGame', script: testScript, playerCount: 3 }, ctx);
		expect(small.ok && codes(small)).toEqual(['unusual-player-count']);
		const big = createGame({ type: 'CreateGame', script: testScript, playerCount: 16 }, ctx);
		expect(big.ok && codes(big)).toEqual(['unusual-player-count']);
		for (const playerCount of [-1, 2.5, 41, Number.NaN]) {
			const r = createGame({ type: 'CreateGame', script: testScript, playerCount }, ctx);
			expect(r.ok ? 'ok' : r.error.code).toBe('invalid-player-count');
		}
	});

	it('cannot create a game twice, and other commands need a game', () => {
		const { session, ctx } = newGame(5);
		expect(refused(session, ctx, { type: 'CreateGame', script: testScript, playerCount: 5 })).toBe(
			'game-exists'
		);
		const none = decide(undefined, { type: 'AddSeat' }, ctx);
		expect(none.ok ? 'ok' : none.error.code).toBe('no-game');
	});
});

describe('seats', () => {
	it('adds a seat at the end or at a position, with an optional trimmed name', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddSeat', playerName: '  Fay ' },
			{ type: 'AddSeat', position: 0 }
		);
		const [first, ...rest] = s.game.seating;
		expect(rest.slice(0, 5)).toEqual(seats);
		expect(s.game.seats[rest[5]].playerName).toBe('Fay');
		expect(s.game.seats[first].playerName).toBeUndefined();
		expect(refused(s, ctx, { type: 'AddSeat', position: 99 })).toBe('invalid-position');
		expect(refused(s, ctx, { type: 'AddSeat', position: -1 })).toBe('invalid-position');
	});

	it('caps the number of seats', () => {
		const { session, ctx } = newGame(40);
		expect(refused(session, ctx, { type: 'AddSeat' })).toBe('invalid-player-count');
	});

	it('removes a seat and its reminders, warning when it had a character', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'chef' },
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		);
		const removed = dispatch(s, { type: 'RemoveSeat', seatId: seats[1] }, ctx);
		if (!removed.ok) throw new Error();
		expect(codes(removed)).toEqual(['seat-has-character']);
		expect(removed.session.game.seating).toEqual([seats[0], ...seats.slice(2)]);
		expect(removed.session.game.seats[seats[1]]).toBeUndefined();
		expect(warned(s, ctx, { type: 'RemoveSeat', seatId: seats[0] })).toEqual([]);
		expect(refused(s, ctx, { type: 'RemoveSeat', seatId: 'nobody' })).toBe('unknown-seat');
	});

	it('renames and clears names; an unchanged name is a no-op', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'RenameSeat', seatId: seats[0], playerName: ' Anya ' });
		expect(s.game.seats[seats[0]].playerName).toBe('Anya');
		const cleared = run(s, ctx, { type: 'RenameSeat', seatId: seats[0], playerName: '   ' });
		expect('playerName' in cleared.game.seats[seats[0]]).toBe(false);
		const same = dispatch(s, { type: 'RenameSeat', seatId: seats[0], playerName: 'Anya' }, ctx);
		expect(same.ok && same.session).toBe(s);
		expect(same.ok && codes(same)).toEqual(['no-change']);
	});

	it('swaps seats (the Matron) and refuses swapping a seat with itself', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'SwapSeats', seatA: seats[0], seatB: seats[4] });
		expect(s.game.seating).toEqual([seats[4], ...seats.slice(1, 4), seats[0]]);
		expect(refused(s, ctx, { type: 'SwapSeats', seatA: seats[0], seatB: seats[0] })).toBe(
			'same-seat'
		);
		expect(refused(s, ctx, { type: 'SwapSeats', seatA: seats[0], seatB: 'x' })).toBe(
			'unknown-seat'
		);
	});
});

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
	// Traveller's alignment.
	it('requires an alignment for a Traveller', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			refused(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'beggar' })
		).toBe('traveller-needs-alignment');
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

describe('reminders', () => {
	it('adds a reminder to a seat with a new id', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'poisoner' },
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}
		);
		expect(s.warnings).toEqual([]);
		expect(s.game.seats[seats[1]].reminders).toEqual([
			{ reminderId: 'id-7', characterId: 'poisoner', label: 'Poisoned' }
		]);
	});

	it('warns about reminders the character does not have, or whose character is not in play', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			warned(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'poisoner', label: 'Drunk' }
			})
		).toEqual(['reminder-not-for-character']);
		expect(
			warned(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			})
		).toEqual(['reminder-character-not-in-play']);
		// Global reminders are available whenever the character is on the script.
		expect(
			warned(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			})
		).toEqual([]);
		expect(
			refused(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'nope', label: 'X' }
			})
		).toBe('unknown-character');
	});

	it('warns when an "Is The …" reminder disagrees with the seat alignment', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' });
		expect(
			warned(s, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'marionette', label: 'Is The Marionette' }
			})
		).toEqual(['alignment-differs-from-true-character']);
	});

	it('moves and removes reminders', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: 'drunk', label: 'Is The Drunk' }
		});
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		const moved = run(s, ctx, { type: 'MoveReminder', reminderId: id, toSeatId: seats[2] });
		expect(moved.game.seats[seats[0]].reminders).toEqual([]);
		expect(moved.game.seats[seats[2]].reminders.map((r) => r.reminderId)).toEqual([id]);
		expect(
			warned(moved, ctx, { type: 'MoveReminder', reminderId: id, toSeatId: seats[2] })
		).toEqual(['no-change']);
		expect(refused(moved, ctx, { type: 'MoveReminder', reminderId: 'x', toSeatId: seats[2] })).toBe(
			'unknown-reminder'
		);
		expect(refused(moved, ctx, { type: 'MoveReminder', reminderId: id, toSeatId: 'x' })).toBe(
			'unknown-seat'
		);
		const removed = run(moved, ctx, { type: 'RemoveReminder', reminderId: id });
		expect(removed.game.seats[seats[2]].reminders).toEqual([]);
		expect(refused(removed, ctx, { type: 'RemoveReminder', reminderId: id })).toBe(
			'unknown-reminder'
		);
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
});
