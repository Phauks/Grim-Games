import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	cancelRequest,
	join,
	MAX_MEMBERS,
	MIN_ROOM_PROTOCOL,
	newRoom,
	parseClientMessage,
	playerView,
	publish,
	request,
	resolve,
	ROOM_PROTOCOL,
	supportsProtocol,
	unseat,
	type RoomState
} from './room.ts';

const s = (id: string) => id as SeatId;

function table(...ids: string[]): PublicGameState {
	return {
		seats: ids.map((id, i) => ({
			seatId: s(id),
			seatNumber: i + 1,
			dead: false
		})),
		today: { nominations: [], executions: [] }
	};
}

function roomWith(...members: string[]): RoomState {
	let room = publish(newRoom('hash'), 'g1', table('a', 'b', 'c'));
	for (const m of members) room = join(room, m)!;
	return room;
}

describe('the live room', () => {
	it('lets a phone ask for a seat, and only the Storyteller seats it', () => {
		let room = roomWith('alex');
		room = request(room, 'alex', { name: '  Alex   K ', seatId: 'b' }, 1, 'r1');
		expect(room.requests).toEqual([
			{ requestId: 'r1', memberId: 'alex', name: 'Alex K', seatId: 'b', at: 1 }
		]);
		expect(playerView(room, 'alex').me).toEqual({ memberId: 'alex' });
		expect(playerView(room, 'alex').request).toEqual({ name: 'Alex K', seatId: 'b' });

		room = resolve(room, 'r1', true);
		expect(room.requests).toEqual([]);
		expect(playerView(room, 'alex').me).toEqual({ memberId: 'alex', name: 'Alex K', seatId: 'b' });
		expect(playerView(room, 'alex').takenSeats).toEqual(['b']);
	});

	it('lets the Storyteller choose a different seat', () => {
		let room = request(roomWith('alex'), 'alex', { name: 'Alex' }, 1, 'r1');
		room = resolve(room, 'r1', true, s('c'));
		expect(room.members).toEqual([{ memberId: 'alex', name: 'Alex', seatId: 'c' }]);
	});

	it('drops a declined request without changing the member', () => {
		let room = request(roomWith('alex'), 'alex', { name: 'Alex' }, 1, 'r1');
		room = resolve(room, 'r1', false);
		expect(room.requests).toEqual([]);
		expect(room.members).toEqual([{ memberId: 'alex' }]);
	});

	it('keeps one request per phone, and lets it be cancelled', () => {
		let room = request(roomWith('alex'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r1');
		room = request(room, 'alex', { name: 'Alex', seatId: 'c' }, 2, 'r2');
		expect(room.requests.map((r) => r.requestId)).toEqual(['r2']);
		expect(cancelRequest(room, 'alex').requests).toEqual([]);
	});

	it('ignores empty names, unknown seats and strangers', () => {
		const room = roomWith('alex');
		expect(request(room, 'alex', { name: '   ' }, 1, 'r')).toBe(room);
		expect(request(room, 'alex', { name: 'Alex', seatId: 'zz' }, 1, 'r')).toBe(room);
		expect(request(room, 'alex', { name: 'Alex', seatId: 7 }, 1, 'r')).toBe(room);
		expect(request(room, 'nobody', { name: 'Eve' }, 1, 'r')).toBe(room);
		expect(request(room, 'alex', { name: 42 }, 1, 'r')).toBe(room);
	});

	it('moves an earlier phone out of a seat the Storyteller gives to someone else', () => {
		let room = request(roomWith('alex', 'sam'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r1');
		room = resolve(room, 'r1', true);
		room = resolve(request(room, 'sam', { name: 'Sam', seatId: 'a' }, 2, 'r2'), 'r2', true);
		expect(room.members).toEqual([
			{ memberId: 'alex', name: 'Alex' },
			{ memberId: 'sam', name: 'Sam', seatId: 'a' }
		]);
	});

	it('unseats a player but keeps their name', () => {
		let room = resolve(
			request(roomWith('alex'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r'),
			'r',
			true
		);
		room = unseat(room, 'alex');
		expect(room.members).toEqual([{ memberId: 'alex', name: 'Alex' }]);
	});

	it('clears seats for a removed seat or a new game, keeping names', () => {
		let room = resolve(
			request(roomWith('alex'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r'),
			'r',
			true
		);
		room = request(room, 'alex', { name: 'Alex', seatId: 'b' }, 2, 'r2');
		expect(publish(room, 'g1', table('a', 'b')).members[0].seatId).toBe('a');

		const removed = publish(room, 'g1', table('b', 'c'));
		expect(removed.members).toEqual([{ memberId: 'alex', name: 'Alex' }]);

		const next = publish(room, 'g2', table('a', 'b'));
		expect(next.members).toEqual([{ memberId: 'alex', name: 'Alex' }]);
		expect(next.requests[0]).not.toHaveProperty('seatId');
		expect(next.gameId).toBe('g2');
	});

	it('turns phones away once the room is full', () => {
		let room = newRoom('hash');
		for (let i = 0; i < MAX_MEMBERS; i++) room = join(room, `m${i}`)!;
		expect(join(room, 'one-more')).toBeNull();
		expect(join(room, 'm0')).toBe(room);
	});

	it('ignores malformed messages', () => {
		expect(parseClientMessage('not json')).toBeNull();
		expect(parseClientMessage('[1]')).toBeNull();
		expect(parseClientMessage('{"type":1}')).toBeNull();
		expect(parseClientMessage('{"type":"leave-seat"}')).toEqual({ type: 'leave-seat' });
	});

	it('tells apps older than the room speaks to update, and still accepts this build', () => {
		expect(supportsProtocol(ROOM_PROTOCOL)).toBe(true);
		// Apps from before the protocol number existed speak protocol 1.
		expect(supportsProtocol(undefined)).toBe(MIN_ROOM_PROTOCOL <= 1);
		expect(supportsProtocol(MIN_ROOM_PROTOCOL - 1)).toBe(false);
		expect(supportsProtocol('1')).toBe(false);
		expect(supportsProtocol(1.5)).toBe(false);
	});
});
