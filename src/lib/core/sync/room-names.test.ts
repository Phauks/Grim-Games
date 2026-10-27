import { describe, expect, it } from 'vitest';
import { numberedNames } from './room-names.ts';
import { hostView, join, markHere, newRoom, playerView, publish, seat, setName } from './room.ts';
import type { RoomState } from './room.ts';

const table = { seats: [] } as unknown as Parameters<typeof publish>[2];

function named(room: RoomState, ...people: [string, string][]): RoomState {
	for (const [id, name] of people) room = markHere(setName(join(room, id)!, id, { name }), id);
	return room;
}

describe('numbered names (Trevor, 2026-10-27)', () => {
	it('numbers a shared name in join order, ignoring case and spaces', () => {
		const room = named(
			publish(newRoom('hash'), 'g1', table),
			['a', 'John'],
			['b', 'Ana'],
			['c', ' john '],
			['d', 'JOHN']
		);
		expect(numberedNames(room)).toEqual({ c: 'john 2', d: 'JOHN 3' });
		expect(hostView(room).members.map((m) => m.name)).toEqual(['John', 'Ana', 'john 2', 'JOHN 3']);
	});

	it("skips a number another player's own name already has", () => {
		const room = named(
			publish(newRoom('hash'), 'g1', table),
			['a', 'John'],
			['b', 'John 2'],
			['c', 'John']
		);
		expect(numberedNames(room)).toEqual({ c: 'John 3' });
	});

	it('tells the phone the name the Storyteller sees, until it changes its own', () => {
		let room = named(publish(newRoom('hash'), 'g1', table), ['a', 'John'], ['b', 'John']);
		expect(playerView(room, 'a').shownAs).toBeUndefined();
		expect(playerView(room, 'b').shownAs).toBe('John 2');
		room = setName(room, 'b', { name: 'John B' });
		expect(playerView(room, 'b').shownAs).toBeUndefined();
		expect(hostView(room).members.map((m) => m.name)).toEqual(['John', 'John B']);
	});

	it('leaves out phones from earlier games', () => {
		let room = named(publish(newRoom('hash'), 'g1', table), ['old', 'John']);
		room = publish(room, 'g2', table, new Set());
		room = named(room, ['new', 'John']);
		// The earlier game's John is not connected and not at this game.
		expect(numberedNames(room, new Set(['new']))).toEqual({});
		// Connected again, they are at this game: the later joiner is numbered.
		expect(numberedNames(room, new Set(['new', 'old']))).toEqual({ new: 'John 2' });
	});

	it("keeps a seated player's name when a phone with the same name comes back", () => {
		let room = named(publish(newRoom('hash'), 'g1', table), ['old', 'John']);
		room = publish(room, 'g2', { seats: [{ seatId: 's1' }] } as unknown as typeof table, new Set());
		room = seat(named(room, ['new', 'John']), 'new', 's1');
		expect(numberedNames(room, new Set(['new', 'old']))).toEqual({ old: 'John 2' });
	});
});
