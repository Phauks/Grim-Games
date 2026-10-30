import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	castVote,
	hostView,
	isRemoved,
	join,
	letBackIn,
	newRoom,
	openVote,
	publish,
	removeMember,
	seat,
	setName,
	type RoomState
} from './room.ts';

// Remove from room (plan J37; Trevor, 2026-10-29: "only good for that game, but the kick can be
// revoked").

function table(...ids: string[]): PublicGameState {
	return {
		seats: ids.map((id, i) => ({ seatId: id as SeatId, seatNumber: i + 1, dead: false })),
		today: { nominations: [], executions: [] }
	};
}

/** Alex in seat a, Jo watching and voting. */
function room(): RoomState {
	let r = publish(newRoom('hash'), 'g1', table('a', 'b'));
	for (const m of ['alex', 'jo']) r = join(r, m)!;
	r = seat(setName(r, 'alex', { name: 'Alex' }), 'alex', 'a');
	r = setName(r, 'jo', { name: 'Jo' });
	return castVote(openVote(r, 'v1', ['a', 'b']), 'jo', 'v1', 'b' as SeatId);
}

describe('removeMember', () => {
	it('takes the phone and its seat out of the room, and lists it by name', () => {
		const r = removeMember(room(), 'alex');
		expect(r.members.map((m) => m.memberId)).toEqual(['jo']);
		expect(isRemoved(r, 'alex')).toBe(true);
		expect(hostView(r).removed).toEqual([{ memberId: 'alex', name: 'Alex' }]);
	});

	it("drops the phone's vote", () => {
		const r = removeMember(room(), 'jo');
		expect(r.vote?.votes).toEqual({});
	});

	it('does nothing for a phone that is not in the room', () => {
		const r = room();
		expect(removeMember(r, 'nobody')).toBe(r);
	});
});

describe('letBackIn', () => {
	it('lets the phone join again, with no seat', () => {
		const r = letBackIn(removeMember(room(), 'alex'), 'alex');
		expect(isRemoved(r, 'alex')).toBe(false);
		expect(hostView(r).removed).toBeUndefined();
		const back = join(r, 'alex')!;
		expect(back.members.find((m) => m.memberId === 'alex')?.seatId).toBeUndefined();
	});
});

it('a new game lets every removed phone back in', () => {
	const r = removeMember(room(), 'alex');
	expect(isRemoved(publish(r, 'g1', table('a', 'b')), 'alex')).toBe(true);
	expect(isRemoved(publish(r, 'g2', table('a', 'b')), 'alex')).toBe(false);
});
