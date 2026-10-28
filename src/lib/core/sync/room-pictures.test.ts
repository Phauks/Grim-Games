import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	hostView,
	join,
	judgePicture,
	newRoom,
	playerView,
	publish,
	reportPicture,
	seat,
	setLook,
	setName,
	townView,
	type RoomState
} from './room.ts';

// Players' own pictures (Trevor, 2026-10-27: "allow setting users profile/icon in the player
// settings ... report image ... let it stand, or to remove/revoke avatar for that game").

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

function table(...ids: string[]): PublicGameState {
	return {
		seats: ids.map((id, i) => ({ seatId: id as SeatId, seatNumber: i + 1, dead: false })),
		today: { nominations: [], executions: [] }
	};
}

/** Alex in seat a with picture A, Sam in seat b, Jo watching. */
function room(): RoomState {
	let r = publish(newRoom('hash'), 'g1', table('a', 'b'));
	for (const m of ['alex', 'sam', 'jo']) r = join(r, m)!;
	r = seat(setName(r, 'alex', { name: 'Alex' }), 'alex', 'a');
	r = seat(setName(r, 'sam', { name: 'Sam' }), 'sam', 'b');
	return setLook(r, 'alex', { avatar: 'initials', picture: A }, A);
}

describe("players' pictures in a room", () => {
	it('shows only the picture the phone uploaded, on its seat, to every grim', () => {
		const r = room();
		expect(r.members[0].picture).toBe(A);
		expect(playerView(r, 'sam').pictures).toEqual({ a: A });
		expect(townView(r).pictures).toEqual({ a: A });
		// Someone else's picture, or none uploaded, isn't taken.
		expect(setLook(r, 'sam', { avatar: 'initials', picture: A }, B).members[1].picture).toBe(
			undefined
		);
		expect(setLook(r, 'sam', { picture: 'not-a-hash' }, 'not-a-hash').members[1]).toEqual({
			memberId: 'sam',
			name: 'Sam',
			seatId: 'b'
		});
	});

	it('takes reports from other phones once each, never on an empty seat or your own', () => {
		let r = room();
		expect(reportPicture(r, 'alex', 'a', 1)).toBe(r);
		expect(reportPicture(r, 'sam', 'b', 1)).toBe(r);
		expect(reportPicture(r, 'stranger', 'a', 1)).toBe(r);
		r = reportPicture(r, 'sam', 'a', 1);
		expect(reportPicture(r, 'sam', 'a', 2)).toBe(r);
		r = reportPicture(r, 'jo', 'a', 2);
		expect(hostView(r).pictureReports).toEqual([{ hash: A, memberId: 'alex', count: 2, at: 1 }]);
		// Phones are never told who reported what.
		expect(playerView(r, 'alex')).not.toHaveProperty('pictureReports');
	});

	it('lets a picture stand, so reporting it again does nothing', () => {
		let r = reportPicture(room(), 'sam', 'a', 1);
		r = judgePicture(r, A, true);
		expect(hostView(r).pictureReports).toBeUndefined();
		expect(r.members[0].picture).toBe(A);
		expect(reportPicture(r, 'jo', 'a', 2)).toBe(r);
	});

	it("removes the player's picture for the rest of the game, and a new game starts clean", () => {
		let r = reportPicture(room(), 'sam', 'a', 1);
		r = judgePicture(r, A, false);
		expect(r.members[0].picture).toBeUndefined();
		expect(playerView(r, 'sam').pictures).toBeUndefined();
		expect(hostView(r).pictureReports).toBeUndefined();
		// Not even another picture of theirs this game.
		expect(setLook(r, 'alex', { avatar: 'initials', picture: B }, B).members[0].picture).toBe(
			undefined
		);
		// Only a report's own picture is judged.
		expect(judgePicture(r, B, false)).toBe(r);

		r = publish(r, 'g2', table('a', 'b'));
		expect(r.pictures).toBeUndefined();
		expect(setLook(r, 'alex', { avatar: 'initials', picture: B }, B).members[0].picture).toBe(B);
	});
});
