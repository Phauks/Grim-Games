import { describe, expect, it } from 'vitest';
import {
	newGame,
	run,
	testCharacters,
	testContext,
	testScript
} from '#lib/core/model/fixtures.test-support.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/index.ts';
import { GENERIC_REMINDER_ID, type SymbolColour } from '#lib/core/model/index.ts';
import type { Command } from './commands.ts';
import { decide } from './decide.ts';
import { createGame, dispatch, redo, undo, type GameSession } from './log.ts';
import { applyEvent } from './reducer.ts';
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

	it("keeps the Storyteller's note on a seat, trimmed, undoable and clearable", () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'SetSeatNote',
			seatId: seats[2],
			note: '  Word: banana\nAsked twice '
		});
		expect(s.game.seats[seats[2]].note).toBe('Word: banana\nAsked twice');
		expect('note' in undo(s).game.seats[seats[2]]).toBe(false);
		const same = dispatch(
			s,
			{ type: 'SetSeatNote', seatId: seats[2], note: 'Word: banana\nAsked twice' },
			ctx
		);
		expect(same.ok && codes(same)).toEqual(['no-change']);
		const cleared = run(s, ctx, { type: 'SetSeatNote', seatId: seats[2], note: ' ' });
		expect('note' in cleared.game.seats[seats[2]]).toBe(false);
		expect(refused(s, ctx, { type: 'SetSeatNote', seatId: 'nobody', note: 'x' })).toBe(
			'unknown-seat'
		);
	});

	it("keeps the avatar and frame a seat's player picked, and clears them (plan R6)", () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'SetSeatLook',
			seatId: seats[1],
			avatar: 'initials',
			frame: 'ring'
		});
		expect(s.game.seats[seats[1]]).toMatchObject({ avatar: 'initials', frame: 'ring' });
		const same = dispatch(
			s,
			{ type: 'SetSeatLook', seatId: seats[1], avatar: 'initials', frame: 'ring' },
			ctx
		);
		expect(same.ok && codes(same)).toEqual(['no-change']);
		const cleared = run(s, ctx, { type: 'SetSeatLook', seatId: seats[1], avatar: 'initials' });
		expect(cleared.game.seats[seats[1]].avatar).toBe('initials');
		expect('frame' in cleared.game.seats[seats[1]]).toBe(false);
		expect(refused(s, ctx, { type: 'SetSeatLook', seatId: 'nobody' })).toBe('unknown-seat');
		// A picture from the earlier icon set, saved by that beta build, is dropped on replay.
		const replayed = applyEvent(s.game, {
			type: 'SeatLookSet',
			seatId: seats[1],
			avatar: 'cat' as never
		});
		expect('avatar' in replayed.seats[seats[1]]).toBe(false);
	});

	it("keeps the Storyteller's titled game notes, trimmed, undoable and deletable", () => {
		const { session, ctx } = newGame(names);
		const note = { title: ' Fang Gu ', text: ' Ana asked about the Fang Gu\n', hidden: false };
		const s = run(session, ctx, { type: 'SetGameNote', ...note });
		expect(s.game.notes).toEqual([
			{ noteId: 'n1', title: 'Fang Gu', text: 'Ana asked about the Fang Gu', hidden: false }
		]);
		expect('notes' in undo(s).game).toBe(false);
		// A second note goes after the first; editing one keeps its place.
		const two = run(s, ctx, { type: 'SetGameNote', title: 'Bluffs', text: '', hidden: true });
		const edited = run(two, ctx, { type: 'SetGameNote', noteId: 'n1', ...note, text: 'Asked' });
		expect(edited.game.notes?.map((n) => [n.noteId, n.title, n.text, n.hidden])).toEqual([
			['n1', 'Fang Gu', 'Asked', false],
			['n2', 'Bluffs', '', true]
		]);
		const same = dispatch(
			edited,
			{ type: 'SetGameNote', noteId: 'n2', title: 'Bluffs', text: '', hidden: true },
			ctx
		);
		expect(same.ok && codes(same)).toEqual(['no-change']);
		// A blank new note is not kept.
		const blank = dispatch(s, { type: 'SetGameNote', title: ' ', text: '', hidden: false }, ctx);
		expect(blank.ok && codes(blank)).toEqual(['no-change']);
		const deleted = run(edited, ctx, { type: 'DeleteGameNote', noteId: 'n1' });
		expect(deleted.game.notes?.map((n) => n.noteId)).toEqual(['n2']);
		expect('notes' in run(deleted, ctx, { type: 'DeleteGameNote', noteId: 'n2' }).game).toBe(false);
		expect(refused(s, ctx, { type: 'DeleteGameNote', noteId: 'n9' })).toBe('unknown-note');
		expect(refused(s, ctx, { type: 'SetGameNote', noteId: 'n9', ...note })).toBe('unknown-note');
	});

	it("replays an older game's single general note as its first, untitled note", () => {
		const { session } = newGame(names);
		const game = applyEvent(session.game, { type: 'GameNotesSet', notes: 'Ana asked' });
		expect(game.notes).toEqual([{ noteId: 'n1', title: '', text: 'Ana asked', hidden: false }]);
		expect('notes' in applyEvent(game, { type: 'GameNotesSet' })).toBe(false);
	});

	it('moves the note with its player when seats swap', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'SetSeatNote', seatId: seats[0], note: 'Amnesiac: learns a yes/no' },
			{ type: 'SwapSeats', seatA: seats[0], seatB: seats[4] }
		);
		expect(s.game.seats[seats[0]].note).toBe('Amnesiac: learns a yes/no');
		expect(s.game.seating.at(-1)).toBe(seats[0]);
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

	it('rotates everyone one seat round, as one undoable step', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' });
		const clockwise = run(s, ctx, { type: 'RotateSeats', direction: 'clockwise' });
		// The player in seat 1 is now in seat 2, keeping their character.
		expect(clockwise.game.seating).toEqual([seats[4], ...seats.slice(0, 4)]);
		expect(clockwise.game.seats[seats[0]].characterId).toBe('chef');
		const anticlockwise = run(s, ctx, { type: 'RotateSeats', direction: 'anticlockwise' });
		expect(anticlockwise.game.seating).toEqual([...seats.slice(1), seats[0]]);
		expect(undo(clockwise).game.seating).toEqual(seats);
	});

	// Trevor (2026-10-22): every name moves with its player, a seat-number name too.
	it('gives unnamed seats the seat number they showed before moving them', () => {
		const fresh = newGame(5);
		const { ctx, seats } = fresh;
		const session = run(fresh.session, ctx, {
			type: 'RenameSeat',
			seatId: seats[0],
			playerName: 'Ana'
		});
		const s = run(session, ctx, { type: 'RotateSeats', direction: 'clockwise' });
		expect(s.game.seats[seats[0]].playerName).toBe('Ana');
		expect(s.game.seats[seats[1]].playerName).toBe('Seat 2');
		expect(s.game.seating.indexOf(seats[1])).toBe(2);
		const moved = run(session, ctx, { type: 'MoveSeat', seatId: seats[4], position: 0 });
		expect(moved.game.seats[seats[4]].playerName).toBe('Seat 5');
		expect(undo(s).game.seats[seats[1]].playerName).toBeUndefined();
	});

	it('moves one player to another place, the others closing up', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'MoveSeat', seatId: seats[0], position: 3 });
		expect(s.game.seating).toEqual([seats[1], seats[2], seats[3], seats[0], seats[4]]);
		const back = run(s, ctx, { type: 'MoveSeat', seatId: seats[0], position: 0 });
		expect(back.game.seating).toEqual(seats);
		expect(warned(back, ctx, { type: 'MoveSeat', seatId: seats[0], position: 0 })).toEqual([
			'no-change'
		]);
		expect(refused(s, ctx, { type: 'MoveSeat', seatId: seats[0], position: 5 })).toBe(
			'invalid-position'
		);
		expect(undo(s).game.seating).toEqual(seats);
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

describe('reminders on Fabled and Loric', () => {
	// Trevor (2026-10-17): Fabled and Loric can hold reminders; others' reminders may go
	// there too, with a caution.
	it('places, moves and removes reminders held by a rule character', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'fibbin' },
			{ type: 'AddRuleCharacter', characterId: 'bootlegger' },
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' }
		);
		const added = run(s, ctx, {
			type: 'AddRuleReminder',
			characterId: 'fibbin',
			reminder: { characterId: 'fibbin', label: 'No Ability' }
		});
		const [held] = added.game.ruleReminders!.fibbin;
		expect(held).toMatchObject({ characterId: 'fibbin', label: 'No Ability' });

		// Onto another rule character, then onto a seat, then back.
		const toLoric = run(added, ctx, {
			type: 'MoveReminderToRuleCharacter',
			reminderId: held.reminderId,
			characterId: 'bootlegger'
		});
		expect(toLoric.game.ruleReminders!.fibbin).toEqual([]);
		expect(toLoric.game.ruleReminders!.bootlegger).toEqual([held]);
		const toSeat = run(toLoric, ctx, {
			type: 'MoveReminder',
			reminderId: held.reminderId,
			toSeatId: seats[1]
		});
		expect(toSeat.game.ruleReminders!.bootlegger).toEqual([]);
		expect(toSeat.game.seats[seats[1]].reminders).toEqual([held]);
		const back = run(toSeat, ctx, {
			type: 'MoveReminderToRuleCharacter',
			reminderId: held.reminderId,
			characterId: 'fibbin'
		});
		expect(back.game.seats[seats[1]].reminders).toEqual([]);
		expect(back.game.ruleReminders!.fibbin).toEqual([held]);

		const removed = run(back, ctx, { type: 'RemoveReminder', reminderId: held.reminderId });
		expect(removed.game.ruleReminders!.fibbin).toEqual([]);
	});

	it("warns when the reminder isn't a Fabled's or Loric's, and refuses a holder not in play", () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' }
		);
		expect(
			warned(s, ctx, {
				type: 'AddRuleReminder',
				characterId: 'angel',
				reminder: { characterId: 'imp', label: 'Dead' }
			})
		).toContain('reminder-not-from-rule-character');
		expect(
			warned(s, ctx, {
				type: 'AddRuleReminder',
				characterId: 'angel',
				reminder: { characterId: 'angel', label: 'Protected' }
			})
		).toEqual([]);
		expect(
			refused(s, ctx, {
				type: 'AddRuleReminder',
				characterId: 'fibbin',
				reminder: { characterId: 'fibbin', label: 'No Ability' }
			})
		).toBe('rule-character-not-in-play');
		const onSeat = run(s, ctx, {
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'imp', label: 'Dead' }
		});
		const id = onSeat.game.seats[seats[1]].reminders[0].reminderId;
		expect(
			warned(onSeat, ctx, {
				type: 'MoveReminderToRuleCharacter',
				reminderId: id,
				characterId: 'angel'
			})
		).toContain('reminder-not-from-rule-character');
	});

	it('takes its reminders away when the rule character is removed', () => {
		const { session, ctx } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{
				type: 'AddRuleReminder',
				characterId: 'angel',
				reminder: { characterId: 'angel', label: 'Protected' }
			},
			{ type: 'RemoveRuleCharacter', characterId: 'angel' }
		);
		expect(s.game.ruleCharacters).toEqual([]);
		expect(s.game.ruleReminders).toEqual({});
		// Undo brings both back.
		const undone = undo(s);
		expect(undone.game.ruleReminders!.angel).toHaveLength(1);
	});

	it('reads an older game without rule reminders', () => {
		const { session } = newGame(names);
		expect(session.game.ruleReminders).toBeUndefined();
	});
});

describe('the generic reminder', () => {
	// Trevor (2026-10-18): a plain ∞ reminder, as many as needed, with optional text, instead
	// of a custom reminder. It belongs to no character, so it fits anywhere without a warning.
	it('goes anywhere, takes text, and clears it when emptied', () => {
		const { session, ctx, seats } = newGame(names);
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		expect(
			warned(session, ctx, { type: 'AddReminder', seatId: seats[0], reminder: generic })
		).toEqual([]);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AddReminder', seatId: seats[0], reminder: generic },
			{ type: 'AddRuleReminder', characterId: 'angel', reminder: generic },
			{ type: 'PlaceLooseReminder', reminder: generic }
		);
		const onSeat = s.game.seats[seats[0]].reminders[0];
		const onAngel = s.game.ruleReminders!.angel[0];
		const loose = s.game.looseReminders![0];

		const noted = run(
			s,
			ctx,
			{ type: 'SetReminderNote', reminderId: onSeat.reminderId, note: '  Chose Sam  ' },
			{ type: 'SetReminderNote', reminderId: onAngel.reminderId, note: 'Day 2' },
			{ type: 'SetReminderNote', reminderId: loose.reminderId, note: 'Vote' }
		);
		expect(noted.game.seats[seats[0]].reminders[0].note).toBe('Chose Sam');
		expect(noted.game.ruleReminders!.angel[0].note).toBe('Day 2');
		expect(noted.game.looseReminders![0].note).toBe('Vote');
		expect(
			warned(noted, ctx, {
				type: 'SetReminderNote',
				reminderId: onSeat.reminderId,
				note: 'Chose Sam'
			})
		).toContain('no-change');

		const cleared = run(noted, ctx, {
			type: 'SetReminderNote',
			reminderId: onSeat.reminderId,
			note: '   '
		});
		expect(cleared.game.seats[seats[0]].reminders[0]).not.toHaveProperty('note');
		expect(undo(cleared).game.seats[seats[0]].reminders[0].note).toBe('Chose Sam');
		expect(refused(cleared, ctx, { type: 'SetReminderNote', reminderId: 'nope', note: 'x' })).toBe(
			'unknown-reminder'
		);
	});

	it('takes its own symbol, and clears it when emptied', () => {
		// Trevor (2026-10-19): each generic reminder carries the symbol chosen for it.
		const { session, ctx, seats } = newGame(names);
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		const s = run(session, ctx, { type: 'AddReminder', seatId: seats[0], reminder: generic });
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		const marked = run(s, ctx, { type: 'SetReminderSymbol', reminderId: id, symbol: ' 🦉 ' });
		expect(marked.game.seats[seats[0]].reminders[0].symbol).toBe('🦉');
		expect(
			warned(marked, ctx, { type: 'SetReminderSymbol', reminderId: id, symbol: '🦉' })
		).toContain('no-change');
		const cleared = run(marked, ctx, { type: 'SetReminderSymbol', reminderId: id });
		expect(cleared.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbol');
		expect(undo(cleared).game.seats[seats[0]].reminders[0].symbol).toBe('🦉');
		expect(
			refused(s, ctx, { type: 'SetReminderSymbol', reminderId: id, symbol: 'x'.repeat(40) })
		).toBe('invalid-symbol');
	});

	it("colours the generic reminder's symbol, or clears its colour", () => {
		// Trevor (2026-10-20): the Storyteller picks the colour of a generic token's icon.
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' }
		});
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		const red = run(s, ctx, { type: 'SetReminderSymbolColour', reminderId: id, colour: 'red' });
		expect(red.game.seats[seats[0]].reminders[0].symbolColour).toBe('red');
		expect(
			warned(red, ctx, { type: 'SetReminderSymbolColour', reminderId: id, colour: 'red' })
		).toContain('no-change');
		const cleared = run(red, ctx, { type: 'SetReminderSymbolColour', reminderId: id });
		expect(cleared.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbolColour');
		expect(undo(cleared).game.seats[seats[0]].reminders[0].symbolColour).toBe('red');
		expect(
			refused(s, ctx, {
				type: 'SetReminderSymbolColour',
				reminderId: id,
				colour: 'pink' as SymbolColour
			})
		).toBe('invalid-colour');
	});

	it("fills the generic reminder's symbol, or draws it as an outline again", () => {
		// Trevor (2026-10-23): filled or outlined is chosen per ∞ token, not for all of them.
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' }
		});
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		expect(
			warned(s, ctx, { type: 'SetReminderSymbolFill', reminderId: id, fill: false })
		).toContain('no-change');
		const filled = run(s, ctx, { type: 'SetReminderSymbolFill', reminderId: id, fill: true });
		expect(filled.game.seats[seats[0]].reminders[0].symbolFill).toBe(true);
		const outlined = run(filled, ctx, {
			type: 'SetReminderSymbolFill',
			reminderId: id,
			fill: false
		});
		expect(outlined.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbolFill');
		expect(undo(outlined).game.seats[seats[0]].reminders[0].symbolFill).toBe(true);
		expect(refused(s, ctx, { type: 'SetReminderSymbolFill', reminderId: 'nope', fill: true })).toBe(
			'unknown-reminder'
		);
	});
});

describe('bank ∞ tokens', () => {
	// Plan B9 (Trevor, 2026-10-23: "Tokens only"): "+ New token" makes a reusable ∞ token whose
	// copies start with its symbol, colour and text.
	it('makes, changes and removes a token, and its copies start with its look', () => {
		const { session, ctx, seats } = newGame(names);
		const made = run(session, ctx, {
			type: 'AddGenericToken',
			look: { note: ' Chose Sam ', symbol: 'ph:skull', symbolColour: 'red' }
		});
		const [token] = made.game.genericTokens!;
		expect(token).toEqual({
			tokenId: token.tokenId,
			note: 'Chose Sam',
			symbol: 'ph:skull',
			symbolColour: 'red'
		});
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		const placed = run(
			made,
			ctx,
			{ type: 'AddReminder', seatId: seats[0], reminder: generic, tokenId: token.tokenId },
			{ type: 'PlaceLooseReminder', reminder: generic, tokenId: token.tokenId }
		);
		expect(placed.game.seats[seats[0]].reminders[0]).toMatchObject({
			note: 'Chose Sam',
			symbol: 'ph:skull',
			symbolColour: 'red'
		});
		expect(placed.game.looseReminders![0].symbol).toBe('ph:skull');
		// A filled token's copies start filled (Trevor, 2026-10-23).
		const filledToken = run(placed, ctx, {
			type: 'SetGenericToken',
			tokenId: token.tokenId,
			look: { symbol: 'ph:skull', symbolFill: true }
		});
		expect(filledToken.game.genericTokens![0].symbolFill).toBe(true);
		const filledCopy = run(filledToken, ctx, {
			type: 'PlaceLooseReminder',
			reminder: generic,
			tokenId: token.tokenId
		});
		expect(filledCopy.game.looseReminders![1].symbolFill).toBe(true);
		expect(placed.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbolFill');
		// The token stays in the bank, and changing it leaves the placed copies as they are.
		const changed = run(placed, ctx, {
			type: 'SetGenericToken',
			tokenId: token.tokenId,
			look: { symbol: '🦉' }
		});
		expect(changed.game.genericTokens).toEqual([{ tokenId: token.tokenId, symbol: '🦉' }]);
		expect(changed.game.seats[seats[0]].reminders[0].symbol).toBe('ph:skull');
		expect(
			warned(changed, ctx, {
				type: 'SetGenericToken',
				tokenId: token.tokenId,
				look: { symbol: '🦉' }
			})
		).toContain('no-change');
		const removed = run(changed, ctx, { type: 'RemoveGenericToken', tokenId: token.tokenId });
		expect(removed.game).not.toHaveProperty('genericTokens');
		expect(removed.game.seats[seats[0]].reminders).toHaveLength(1);
		expect(undo(removed).game.genericTokens).toHaveLength(1);
	});

	it('refuses an unknown token, a long symbol and an unknown colour', () => {
		const { session, ctx, seats } = newGame(names);
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		expect(
			refused(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: generic,
				tokenId: 'x'
			})
		).toBe('unknown-token');
		expect(refused(session, ctx, { type: 'RemoveGenericToken', tokenId: 'x' })).toBe(
			'unknown-token'
		);
		expect(
			refused(session, ctx, { type: 'AddGenericToken', look: { symbol: 'x'.repeat(40) } })
		).toBe('invalid-symbol');
		expect(
			refused(session, ctx, {
				type: 'AddGenericToken',
				look: { symbolColour: 'pink' as SymbolColour }
			})
		).toBe('invalid-colour');
	});
});

describe('loose reminders', () => {
	// Trevor (2026-10-17): a reminder put down anywhere on the board belongs to no seat.
	it('places a loose reminder, puts it on a seat or a Fabled, loosens it and removes it', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' }
		);
		const placed = run(s, ctx, {
			type: 'PlaceLooseReminder',
			reminder: { characterId: 'imp', label: 'Dead' }
		});
		const [loose] = placed.game.looseReminders!;
		expect(loose).toMatchObject({ characterId: 'imp', label: 'Dead' });
		expect(placed.game.seats[seats[1]].reminders).toEqual([]);

		const onSeat = run(placed, ctx, {
			type: 'MoveReminder',
			reminderId: loose.reminderId,
			toSeatId: seats[1]
		});
		expect(onSeat.game.looseReminders).toEqual([]);
		expect(onSeat.game.seats[seats[1]].reminders).toEqual([loose]);

		const loosened = run(onSeat, ctx, { type: 'LoosenReminder', reminderId: loose.reminderId });
		expect(loosened.game.seats[seats[1]].reminders).toEqual([]);
		expect(loosened.game.looseReminders).toEqual([loose]);
		expect(
			warned(loosened, ctx, { type: 'LoosenReminder', reminderId: loose.reminderId })
		).toContain('no-change');

		const onAngel = run(loosened, ctx, {
			type: 'MoveReminderToRuleCharacter',
			reminderId: loose.reminderId,
			characterId: 'angel'
		});
		expect(onAngel.game.looseReminders).toEqual([]);
		expect(onAngel.game.ruleReminders!.angel).toEqual([loose]);
		const offAngel = run(onAngel, ctx, { type: 'LoosenReminder', reminderId: loose.reminderId });
		expect(offAngel.game.ruleReminders!.angel).toEqual([]);
		expect(offAngel.game.looseReminders).toEqual([loose]);

		const removed = run(offAngel, ctx, { type: 'RemoveReminder', reminderId: loose.reminderId });
		expect(removed.game.looseReminders).toEqual([]);
		expect(undo(removed).game.looseReminders).toEqual([loose]);
	});

	it('refuses to loosen a reminder that is nowhere, and reads older games', () => {
		const { session, ctx } = newGame(names);
		expect(session.game.looseReminders).toBeUndefined();
		expect(refused(session, ctx, { type: 'LoosenReminder', reminderId: 'nope' })).toBe(
			'unknown-reminder'
		);
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

describe('the Storyteller’s name', () => {
	// Trevor (2026-10-19): typed on New game, shown wherever the game is shown.
	it('starts with the game, outlives undo, changes and clears', () => {
		const ctx = testContext();
		const created = createGame(
			{ type: 'CreateGame', script: testScript, playerCount: 5, storytellerName: '  Sam  ' },
			ctx
		);
		if (!created.ok) throw new Error(created.error.message);
		expect(created.session.game.storytellerName).toBe('Sam');
		const renamed = run(created.session, ctx, { type: 'SetStorytellerName', name: 'Kim' });
		expect(renamed.game.storytellerName).toBe('Kim');
		expect(undo(renamed).game.storytellerName).toBe('Sam');
		expect(warned(renamed, ctx, { type: 'SetStorytellerName', name: 'Kim ' })).toContain(
			'no-change'
		);
		const cleared = run(renamed, ctx, { type: 'SetStorytellerName', name: ' ' });
		expect(cleared.game).not.toHaveProperty('storytellerName');
	});

	it('is absent when none was typed', () => {
		const { session } = newGame(names);
		expect(session.game).not.toHaveProperty('storytellerName');
	});
});
