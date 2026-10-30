import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	countOffSeats,
	countOffView,
	endCountOff,
	hostView,
	join,
	nameCount,
	newRoom,
	playerView,
	publish,
	setName,
	startCountOff,
	takeCount,
	type RoomState
} from './room.ts';

// Count off (plan J40; Trevor, 2026-10-30: one player is the top of the clock, everyone counts
// clockwise and taps their number, names show to everyone, and players without a phone count
// too).

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

/** Four seats; Ana, Bo and Cy's phones joined. */
function room(): RoomState {
	let r = publish(newRoom('hash'), 'g1', table(undefined, undefined, undefined, undefined));
	for (const [id, name] of [
		['ana', 'Ana'],
		['bo', 'Bo'],
		['cy', 'Cy']
	]) {
		r = setName(join(r, id)!, id, { name });
	}
	return r;
}

describe('count off', () => {
	it('starts with a phone as number 1, and phones tap their numbers', () => {
		let r = startCountOff(room(), { memberId: 'bo' });
		r = takeCount(r, 'cy', 2);
		r = takeCount(r, 'ana', 4);
		expect(countOffView(r)).toEqual({
			size: 4,
			tokens: [
				{ number: 1, name: 'Bo' },
				{ number: 2, name: 'Cy' },
				{ number: 4, name: 'Ana' }
			]
		});
		expect(playerView(r, 'ana').countOff?.tokens[2]).toEqual({
			number: 4,
			name: 'Ana',
			mine: true
		});
		expect(hostView(r).countOff?.size).toBe(4);
	});

	it('holds one number a phone, and taking a held number frees it for the other to tap again', () => {
		let r = startCountOff(room(), { memberId: 'bo' });
		r = takeCount(takeCount(r, 'cy', 2), 'cy', 3);
		r = takeCount(r, 'ana', 3);
		expect(countOffView(r)?.tokens).toEqual([
			{ number: 1, name: 'Bo' },
			{ number: 3, name: 'Ana' }
		]);
	});

	it('takes names for players without a phone, and refuses numbers off the clock', () => {
		let r = startCountOff(room(), { name: 'Dan' });
		r = nameCount(r, 3, ' Eve ');
		expect(takeCount(r, 'ana', 5)).toBe(r);
		expect(takeCount(endCountOff(r), 'ana', 2).countOff).toBeUndefined();
		expect(countOffView(r)?.tokens).toEqual([
			{ number: 1, name: 'Dan' },
			{ number: 3, name: 'Eve' }
		]);
		expect(countOffView(nameCount(r, 3, ''))?.tokens).toHaveLength(1);
	});

	it('a new game ends it', () => {
		const r = startCountOff(room(), { memberId: 'bo' });
		expect(publish(r, 'g1', table('A')).countOff).toBeDefined();
		expect(publish(r, 'g2', table('A')).countOff).toBeUndefined();
	});
});

describe('countOffSeats', () => {
	const seating = [s('a'), s('b'), s('c'), s('d')];
	const seats = {
		a: { playerName: 'Cy' },
		b: {},
		c: { playerName: 'Ana' },
		d: { playerName: 'Seat 4' }
	};

	it('gives each number the seat with its name, else an open seat, else a new one', () => {
		const view = {
			size: 5,
			tokens: [
				{ number: 1, name: 'Ana' },
				{ number: 2, name: 'Cy' },
				{ number: 3, name: 'Bo' },
				{ number: 4, name: 'Dan' },
				{ number: 5, name: 'Eve' }
			]
		};
		expect(countOffSeats(seating, seats, view)).toEqual([
			{ seatId: 'c' },
			{ seatId: 'a' },
			{ seatId: 'b', playerName: 'Bo' },
			{ seatId: 'd', playerName: 'Dan' },
			{ playerName: 'Eve' }
		]);
	});

	it('puts the seats nobody counted to in the numbers nobody holds', () => {
		const view = { size: 4, tokens: [{ number: 3, name: 'Cy' }] };
		expect(countOffSeats(seating, seats, view)).toEqual([
			{ seatId: 'b' },
			{ seatId: 'c' },
			{ seatId: 'a' },
			{ seatId: 'd' }
		]);
	});
});
