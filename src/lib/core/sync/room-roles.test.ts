import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	hostView,
	join,
	newRoom,
	playerView,
	publish,
	roleSeen,
	seat,
	setName,
	setRoles,
	type RoomState
} from './room.ts';

const s = (id: string) => id as SeatId;

function table(...ids: string[]): PublicGameState {
	return {
		seats: ids.map((id, i) => ({ seatId: s(id), seatNumber: i + 1, dead: false })),
		today: { nominations: [], executions: [] }
	};
}

/** Alex in seat a, Sam in seat b, of game g1. */
function room(): RoomState {
	let r = publish(newRoom('hash'), 'g1', table('a', 'b', 'c'));
	for (const [id, name, seatId] of [
		['alex', 'Alex', 'a'],
		['sam', 'Sam', 'b']
	]) {
		r = seat(setName(join(r, id)!, id, { name }), id, seatId);
	}
	return r;
}

const roles = { a: { characterId: 'chef' }, b: { characterId: 'imp' } };

describe('players’ own characters in the room', () => {
	it('gives each phone its own seat’s character only, while players may see them', () => {
		const shown = setRoles(room(), 'g1', true, roles);
		expect(playerView(shown, 'alex').role).toEqual({ characterId: 'chef' });
		expect(playerView(shown, 'sam').role).toEqual({ characterId: 'imp' });
		const hidden = setRoles(shown, 'g1', false, roles);
		expect(playerView(hidden, 'alex').role).toBeUndefined();
		// Hidden, the room keeps none of them.
		expect(hidden.roles?.seats).toEqual({});
	});

	it('gives a spectator, or a phone in another seat, nothing', () => {
		let r = setRoles(room(), 'g1', true, roles);
		r = join(r, 'kim')!;
		expect(playerView(r, 'kim').role).toBeUndefined();
		r = seat(setName(r, 'kim', { name: 'Kim' }), 'kim', 'c');
		expect(playerView(r, 'kim').role).toBeUndefined();
	});

	it('tells the Storyteller who has looked, until their character changes', () => {
		let r = setRoles(room(), 'g1', true, roles);
		expect(hostView(r).rolesSeen).toEqual([]);
		r = roleSeen(r, 'alex');
		expect(hostView(r).rolesSeen).toEqual(['a']);
		// Hiding keeps who has looked.
		expect(hostView(setRoles(r, 'g1', false, undefined)).rolesSeen).toEqual(['a']);
		r = setRoles(r, 'g1', true, { ...roles, a: { characterId: 'chef', alignment: 'evil' } });
		expect(hostView(r).rolesSeen).toEqual([]);
	});

	it('ignores looking with nothing to see, and roles for another game or unknown seats', () => {
		const r = room();
		expect(roleSeen(r, 'alex')).toBe(r);
		expect(setRoles(r, 'g2', true, roles)).toBe(r);
		expect(setRoles(r, 'g1', 'yes', roles)).toBe(r);
		const odd = setRoles(r, 'g1', true, { a: { characterId: 'chef' }, z: { characterId: 'imp' } });
		expect(odd.roles?.seats).toEqual({ a: { characterId: 'chef' } });
	});

	it('forgets every character when a new game starts', () => {
		const r = publish(roleSeen(setRoles(room(), 'g1', true, roles), 'alex'), 'g2', table('a', 'b'));
		expect(playerView(r, 'alex').role).toBeUndefined();
		expect(hostView(r).rolesSeen).toEqual([]);
		// The new game's roles start with nobody having looked.
		expect(hostView(setRoles(r, 'g2', true, roles)).rolesSeen).toEqual([]);
	});
});
