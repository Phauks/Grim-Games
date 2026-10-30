/** Commands: creating a game, seats and the Storyteller’s name (decide/seats.ts). */
import { describe, expect, it } from 'vitest';
import {
	codes,
	newGame,
	refused,
	run,
	testContext,
	testScript,
	warned
} from '#lib/core/model/fixtures.test-support.ts';
import { decide } from './decide.ts';
import { createGame, dispatch, undo } from './log.ts';
import { applyEvent } from './reducer.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

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

	it("keeps the Storyteller's titled notes on a seat, several, trimmed, undoable and deletable", () => {
		// Several notes per player, as the game's own (Trevor, 2026-10-26).
		const { session, ctx, seats } = newGame(names);
		const note = {
			seatId: seats[2],
			title: ' Word ',
			text: '  banana\nAsked twice ',
			hidden: false
		};
		const s = run(session, ctx, { type: 'SetSeatNote', ...note });
		expect(s.game.seats[seats[2]].notes).toEqual([
			{ noteId: 'n1', title: 'Word', text: 'banana\nAsked twice', hidden: false }
		]);
		expect('notes' in undo(s).game.seats[seats[2]]).toBe(false);
		// A second note goes after the first; editing one keeps its place.
		const two = run(s, ctx, {
			type: 'SetSeatNote',
			seatId: seats[2],
			title: 'Claim',
			text: 'Chef: 1',
			hidden: true
		});
		const edited = run(two, ctx, { type: 'SetSeatNote', noteId: 'n1', ...note, text: 'apple' });
		expect(
			edited.game.seats[seats[2]].notes?.map((n) => [n.noteId, n.title, n.text, n.hidden])
		).toEqual([
			['n1', 'Word', 'apple', false],
			['n2', 'Claim', 'Chef: 1', true]
		]);
		// Each seat counts its own notes.
		const other = run(edited, ctx, { type: 'SetSeatNote', ...note, seatId: seats[0] });
		expect(other.game.seats[seats[0]].notes?.map((n) => n.noteId)).toEqual(['n1']);
		const same = dispatch(
			edited,
			{ type: 'SetSeatNote', noteId: 'n1', ...note, text: 'apple' },
			ctx
		);
		expect(same.ok && codes(same)).toEqual(['no-change']);
		const blank = dispatch(
			s,
			{ type: 'SetSeatNote', seatId: seats[2], title: ' ', text: '', hidden: false },
			ctx
		);
		expect(blank.ok && codes(blank)).toEqual(['no-change']);
		const deleted = run(edited, ctx, { type: 'DeleteSeatNote', seatId: seats[2], noteId: 'n1' });
		expect(deleted.game.seats[seats[2]].notes?.map((n) => n.noteId)).toEqual(['n2']);
		const none = run(deleted, ctx, { type: 'DeleteSeatNote', seatId: seats[2], noteId: 'n2' });
		expect('notes' in none.game.seats[seats[2]]).toBe(false);
		expect(refused(s, ctx, { type: 'DeleteSeatNote', seatId: seats[2], noteId: 'n9' })).toBe(
			'unknown-note'
		);
		expect(refused(s, ctx, { type: 'SetSeatNote', noteId: 'n9', ...note })).toBe('unknown-note');
		expect(refused(s, ctx, { type: 'SetSeatNote', ...note, seatId: 'nobody' })).toBe(
			'unknown-seat'
		);
	});

	it("replays an older game's single seat note as the seat's first, untitled note", () => {
		const { session, seats } = newGame(names);
		const game = applyEvent(session.game, { type: 'SeatNoteSet', seatId: seats[1], note: 'Word' });
		expect(game.seats[seats[1]].notes).toEqual([
			{ noteId: 'n1', title: '', text: 'Word', hidden: false }
		]);
		const edited = applyEvent(game, { type: 'SeatNoteSet', seatId: seats[1], note: 'Word 2' });
		expect(edited.seats[seats[1]].notes?.map((n) => n.text)).toEqual(['Word 2']);
		expect(
			'notes' in applyEvent(game, { type: 'SeatNoteSet', seatId: seats[1] }).seats[seats[1]]
		).toBe(false);
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
			{
				type: 'SetSeatNote',
				seatId: seats[0],
				title: '',
				text: 'Amnesiac: learns a yes/no',
				hidden: false
			},
			{ type: 'SwapSeats', seatA: seats[0], seatB: seats[4] }
		);
		expect(s.game.seats[seats[0]].notes?.[0].text).toBe('Amnesiac: learns a yes/no');
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

describe('CountOff', () => {
	// Count off (plan J40; Trevor, 2026-10-30: players count clockwise from the top of the clock).
	it('puts the table in the counted order, renames and adds seats, as one step', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'CountOff',
			seats: [
				{ seatId: seats[2] },
				{ seatId: seats[0] },
				{ seatId: seats[4], playerName: 'Fay' as never },
				{ seatId: seats[1] },
				{ seatId: seats[3] },
				{ playerName: 'Gus' as never }
			]
		});
		expect(s.game.seating.slice(0, 5)).toEqual([seats[2], seats[0], seats[4], seats[1], seats[3]]);
		expect(s.game.seats[seats[4]].playerName).toBe('Fay');
		expect(s.game.seats[s.game.seating[5]].playerName).toBe('Gus');
		expect(undo(s).game.seating).toEqual(seats);
		expect(undo(s).game.seats[seats[4]].playerName).toBe('Eve');
	});

	it('lists every seat once, and says when nothing changes', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			refused(session, ctx, {
				type: 'CountOff',
				seats: seats.slice(1).map((seatId) => ({ seatId }))
			})
		).toBe('invalid-position');
		expect(
			warned(session, ctx, { type: 'CountOff', seats: seats.map((seatId) => ({ seatId })) })
		).toEqual(['no-change']);
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
