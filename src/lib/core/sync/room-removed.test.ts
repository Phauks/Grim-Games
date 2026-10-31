import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	castVote,
	hostView,
	isRemoved,
	isRemovedProbe,
	join,
	letBackIn,
	newRoom,
	openVote,
	publish,
	removeMember,
	removedProbe,
	roomPreview,
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

// Trevor, 2026-10-31: a removed phone "should show error before you get to that screen".
describe('the preview tells a removed phone, as the code is typed', () => {
	it('knows the removed phone by its probe, and no other phone', async () => {
		const r = removeMember(room(), 'alex');
		expect(await isRemovedProbe(r, '123456', await removedProbe('123456', 'alex'))).toBe(true);
		expect(await isRemovedProbe(r, '123456', await removedProbe('123456', 'jo'))).toBe(false);
		expect(await isRemovedProbe(r, '123456', null)).toBe(false);
	});

	it('gives a different probe in every room, so it names no phone', async () => {
		const r = removeMember(room(), 'alex');
		expect(await removedProbe('123456', 'alex')).not.toBe(await removedProbe('654321', 'alex'));
		expect(await isRemovedProbe(r, '123456', await removedProbe('654321', 'alex'))).toBe(false);
	});

	it('stops once the Storyteller unblocks the phone', async () => {
		const r = letBackIn(removeMember(room(), 'alex'), 'alex');
		expect(await isRemovedProbe(r, '123456', await removedProbe('123456', 'alex'))).toBe(false);
	});

	it('says so in the preview only when asked by a removed phone', () => {
		expect(roomPreview(room(), undefined, true).removed).toBe(true);
		expect(roomPreview(room()).removed).toBeUndefined();
		expect(roomPreview(undefined, undefined, true)).toEqual({ open: false });
	});
});
