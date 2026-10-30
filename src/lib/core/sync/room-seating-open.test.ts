import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	dropBetween,
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

describe('dropBetween', () => {
	// Four seats round a ring: top, right, bottom, left.
	const ids = [s('n'), s('e'), s('s'), s('w')];
	const points = [
		{ x: 50, y: 0 },
		{ x: 100, y: 50 },
		{ x: 50, y: 100 },
		{ x: 0, y: 50 }
	];

	it('names the two seats either side of the drop', () => {
		expect(dropBetween(ids, points, { x: 90, y: 10 })).toEqual({ after: 'n', before: 'e' });
		expect(dropBetween(ids, points, { x: 5, y: 10 })).toEqual({ after: 'w', before: 'n' });
	});

	it('has nothing to drop between at an empty table', () => {
		expect(dropBetween([], [], { x: 50, y: 50 })).toBeUndefined();
	});
});
