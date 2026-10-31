import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	dropOnto,
	placedSeat,
	hostView,
	join,
	newRoom,
	playerView,
	publish,
	seat,
	setName,
	setSeatingOpen,
	sitCommands,
	sitWish,
	type RoomState
} from './room.ts';

// Seating on the grim (plan J38; Trevor, 2026-10-29 22:36: each phone drags its own disc, the
// drop names its neighbours, the Storyteller locks seating, then phones claim open seats).

const s = (id: string) => id as SeatId;

function table(...names: (string | undefined)[]): PublicGameState {
	return {
		seats: names.map((playerName, i) => ({
			seatId: s(`s${i + 1}`),
			seatNumber: i + 1,
			dead: false,
			...(playerName ? { playerName } : {})
		})),
		today: { nominations: [], executions: [] }
	};
}

/** Ana in seat s1, Bo named but with no seat. */
function room(): RoomState {
	let r = publish(newRoom('hash'), 'g1', table('Ana', undefined, 'Cy'));
	for (const m of ['ana', 'bo']) r = join(r, m)!;
	r = seat(setName(r, 'ana', { name: 'Ana' }), 'ana', 's1');
	return setName(r, 'bo', { name: 'Bo' });
}

describe('seating open', () => {
	it('is shown to the Storyteller and the phones, and a new game locks it', () => {
		const r = setSeatingOpen(room(), true);
		expect(hostView(r).seatingOpen).toBe(true);
		expect(playerView(r, 'bo').seatingOpen).toBe(true);
		expect(publish(r, 'g1', table('Ana')).seatingOpen).toBe(true);
		expect(publish(r, 'g2', table('Ana')).seatingOpen).toBeUndefined();
		expect(setSeatingOpen(r, false).seatingOpen).toBeUndefined();
	});
});

describe('sitWish', () => {
	it('passes a move on only while seating is open', () => {
		const sit = { type: 'sit', after: 's3' } as const;
		expect(sitWish(room(), 'ana', sit)).toBeUndefined();
		expect(sitWish(setSeatingOpen(room(), true), 'ana', sit)).toEqual({
			type: 'sit',
			memberId: 'ana',
			after: 's3'
		});
		expect(sitWish(setSeatingOpen(room(), true), 'ana', { type: 'sit', after: 'nope' })).toBe(
			undefined
		);
	});

	it('passes on the seat a phone dropped its disc on, only while seating is open', () => {
		const onto = { type: 'sit', onto: 's3' } as const;
		expect(sitWish(room(), 'ana', onto)).toBeUndefined();
		expect(sitWish(setSeatingOpen(room(), true), 'ana', onto)).toEqual({
			type: 'sit',
			memberId: 'ana',
			onto: 's3'
		});
		expect(sitWish(setSeatingOpen(room(), true), 'ana', { type: 'sit', onto: 'nope' })).toBe(
			undefined
		);
	});

	it('passes a claim on only once locked, from a phone with no seat, for an open seat', () => {
		const claim = (seatId: string) => ({ type: 'claim-seat', seatId }) as const;
		expect(sitWish(room(), 'bo', claim('s2'))).toEqual({
			type: 'sit',
			memberId: 'bo',
			seatId: 's2'
		});
		expect(sitWish(room(), 'bo', claim('s3'))).toBeUndefined();
		expect(sitWish(room(), 'ana', claim('s2'))).toBeUndefined();
		expect(sitWish(setSeatingOpen(room(), true), 'bo', claim('s2'))).toBeUndefined();
	});
});

describe('sitCommands', () => {
	const seating = [s('a'), s('b'), s('c'), s('d')];
	const seats = (names: Record<string, string>) =>
		Object.fromEntries(seating.map((id) => [id, names[id] ? { playerName: names[id] } : {}]));

	it("moves the phone's own seat to just after the one it dropped by", () => {
		const named = seats({ a: 'Ana', b: 'Bo', c: 'Cy', d: 'Di' });
		expect(sitCommands(seating, named, 'ana', { after: s('c') })).toEqual([
			{ type: 'MoveSeat', seatId: 'a', position: 2 }
		]);
		expect(sitCommands(seating, named, 'Cy', { after: s('b') })).toEqual([]);
	});

	it('gives a phone with no seat the first open seat, moved there', () => {
		const named = seats({ a: 'Ana', c: 'Cy' });
		expect(sitCommands(seating, named, 'Eve', { after: s('c') })).toEqual([
			{ type: 'RenameSeat', seatId: 'b', playerName: 'Eve' },
			{ type: 'MoveSeat', seatId: 'b', position: 2 }
		]);
	});

	it('counts a seat named only by its number as open, but not one named for a player', () => {
		const named = seats({ a: 'Ana', b: 'Dan', c: 'Seat 3', d: 'Di' });
		expect(sitCommands(seating, named, 'Eve', { seatId: s('c') })).toEqual([
			{ type: 'RenameSeat', seatId: 'c', playerName: 'Eve' }
		]);
		expect(sitCommands(seating, named, 'Eve', { seatId: s('b') })).toEqual([]);
	});

	it('adds a seat when none is open', () => {
		const named = seats({ a: 'Ana', b: 'Bo', c: 'Cy', d: 'Di' });
		expect(sitCommands(seating, named, 'Eve', { after: s('a') })).toEqual([
			{ type: 'AddSeat', playerName: 'Eve', position: 1 }
		]);
	});

	it('names an open seat claimed after the lock, unless it was taken', () => {
		const named = seats({ a: 'Ana' });
		expect(sitCommands(seating, named, 'Bo', { seatId: s('b') })).toEqual([
			{ type: 'RenameSeat', seatId: 'b', playerName: 'Bo' }
		]);
		expect(sitCommands(seating, named, 'Cy', { seatId: s('a') })).toEqual([]);
		expect(sitCommands(seating, named, 'Ana', { seatId: s('b') })).toEqual([]);
	});
});

// Trevor, 2026-10-31: in open seating the drop takes the seat it lights up, not a gap between.
describe('sitCommands onto a seat', () => {
	const seating = [s('a'), s('b'), s('c'), s('d'), s('e')];
	const seats = (names: Record<string, string>) =>
		Object.fromEntries(seating.map((id) => [id, names[id] ? { playerName: names[id] } : {}]));

	it("puts the phone's seat in a player's place, and that player moves one towards it", () => {
		const named = seats({ a: 'Ana', b: 'Bo', c: 'Cy', d: 'Di', e: 'Eve' });
		expect(sitCommands(seating, named, 'Ana', { onto: s('c') })).toEqual([
			{ type: 'MoveSeat', seatId: 'a', position: 2 }
		]);
		expect(sitCommands(seating, named, 'Eve', { onto: s('b') })).toEqual([
			{ type: 'MoveSeat', seatId: 'e', position: 1 }
		]);
		expect(sitCommands(seating, named, 'Cy', { onto: s('c') })).toEqual([]);
	});

	it('swaps places with an open seat, so the chair it left is the empty one', () => {
		const named = seats({ a: 'Ana', b: 'Bo', c: 'Seat 3', d: 'Di' });
		expect(sitCommands(seating, named, 'Ana', { onto: s('c') })).toEqual([
			{ type: 'MoveSeat', seatId: 'a', position: 2 },
			{ type: 'MoveSeat', seatId: 'c', position: 0 },
			{ type: 'RenameSeat', seatId: 'c', playerName: 'Seat 1' }
		]);
		expect(sitCommands(seating, named, 'Bo', { onto: s('c') })).toEqual([
			{ type: 'MoveSeat', seatId: 'b', position: 2 },
			{ type: 'RenameSeat', seatId: 'c', playerName: 'Seat 2' }
		]);
		expect(sitCommands(seating, named, 'Di', { onto: s('e') })).toEqual([
			{ type: 'MoveSeat', seatId: 'd', position: 4 },
			{ type: 'RenameSeat', seatId: 'e', playerName: 'Seat 4' }
		]);
		// An empty seat with a character keeps its name, which moves with the character.
		const dealt = { ...named, c: { playerName: 'Seat 3', characterId: 'chef' } };
		expect(sitCommands(seating, dealt, 'Ana', { onto: s('c') })).toEqual([
			{ type: 'MoveSeat', seatId: 'a', position: 2 },
			{ type: 'MoveSeat', seatId: 'c', position: 0 }
		]);
	});

	it('names an open seat a phone with no seat lands on', () => {
		const named = seats({ a: 'Ana', c: 'Cy' });
		expect(sitCommands(seating, named, 'Eve', { onto: s('d') })).toEqual([
			{ type: 'RenameSeat', seatId: 'd', playerName: 'Eve' }
		]);
	});

	it("brings the first open seat to a player's place for a phone with no seat, or adds one", () => {
		const named = seats({ a: 'Ana', c: 'Cy', d: 'Di', e: 'Eve' });
		expect(sitCommands(seating, named, 'Fay', { onto: s('d') })).toEqual([
			{ type: 'RenameSeat', seatId: 'b', playerName: 'Fay' },
			{ type: 'MoveSeat', seatId: 'b', position: 3 }
		]);
		const full = seats({ a: 'Ana', b: 'Bo', c: 'Cy', d: 'Di', e: 'Eve' });
		expect(sitCommands(seating, full, 'Fay', { onto: s('c') })).toEqual([
			{ type: 'AddSeat', playerName: 'Fay', position: 2 }
		]);
	});

	it('does nothing for a seat no longer at the table', () => {
		expect(sitCommands(seating, seats({ a: 'Ana' }), 'Ana', { onto: s('z') })).toEqual([]);
	});
});

describe('dropOnto', () => {
	const ids = [s('n'), s('e'), s('s')];
	const points = [
		{ x: 50, y: 0 },
		{ x: 100, y: 50 },
		{ x: 50, y: 100 }
	];

	it('lights the nearest seat within reach', () => {
		expect(dropOnto(ids, points, { x: 90, y: 40 }, 30)).toBe('e');
		expect(dropOnto(ids, points, { x: 55, y: 5 }, 30)).toBe('n');
	});

	it('lights nothing when the disc is far from every seat', () => {
		expect(dropOnto(ids, points, { x: 50, y: 50 }, 30)).toBeUndefined();
		expect(dropOnto([], [], { x: 50, y: 50 }, 30)).toBeUndefined();
	});
});

// Trevor, 2026-10-31: while seating is open, players move where seats are, not only swap.
describe('moving a seat to a place', () => {
	it('passes on a point on the board, only while seating is open', () => {
		const place = { type: 'sit', place: { x: 20, y: 70 } } as const;
		expect(sitWish(room(), 'ana', place)).toBeUndefined();
		expect(sitWish(setSeatingOpen(room(), true), 'ana', place)).toEqual({
			type: 'sit',
			memberId: 'ana',
			place: { x: 20, y: 70 }
		});
		for (const bad of [{ x: 120, y: 5 }, { x: 'a', y: 5 }, null, { x: Number.NaN, y: 1 }]) {
			expect(sitWish(setSeatingOpen(room(), true), 'ana', { type: 'sit', place: bad })).toBe(
				undefined
			);
		}
	});

	const seating = [s('a'), s('b'), s('c')];
	it("moves the phone's own seat, or names the first open seat for a phone with none", () => {
		expect(placedSeat(seating, { a: { playerName: 'Ana' }, b: {}, c: {} }, 'ana')).toEqual({
			seatId: 'a',
			commands: []
		});
		expect(
			placedSeat(seating, { a: { playerName: 'Ana' }, b: { playerName: 'Seat 2' }, c: {} }, 'Bo')
		).toEqual({ seatId: 'b', commands: [{ type: 'RenameSeat', seatId: 'b', playerName: 'Bo' }] });
		const full = { a: { playerName: 'Ana' }, b: { playerName: 'Cy' }, c: { playerName: 'Di' } };
		expect(placedSeat(seating, full, 'Bo')).toBeUndefined();
	});
});
