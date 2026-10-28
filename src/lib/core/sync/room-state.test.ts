import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import { join, newRoom, type RoomState } from './room.ts';
import { loadRoomState, newStoredRoom, ROOM_STATE_VERSION } from './room-state.ts';

describe('stored room versions', () => {
	it('stamps a new room with the current version', () => {
		expect(newStoredRoom('hash').schemaVersion).toBe(ROOM_STATE_VERSION);
		expect(loadRoomState(undefined)).toBeUndefined();
	});

	it('turns a room from before versions, with requests, into names', () => {
		const old: RoomState = join(join(newRoom('hash'), 'alex')!, 'sam')!;
		old.requests = [
			{ requestId: 'r1', memberId: 'alex', name: 'Alex', seatId: 'a' as SeatId, at: 1 }
		];
		const room = loadRoomState(old)!;
		expect(room.schemaVersion).toBe(1);
		expect(room.requests).toEqual([]);
		expect(room.members.find((m) => m.memberId === 'alex')?.name).toBe('Alex');
		expect(old.requests).toHaveLength(1);
	});

	it('reads a current room as it is', () => {
		const room = newStoredRoom('hash');
		expect(loadRoomState(room)).toBe(room);
	});

	it('reads a room from a newer build as it is', () => {
		const newer = { ...newStoredRoom('hash'), schemaVersion: ROOM_STATE_VERSION + 1 };
		expect(loadRoomState(newer)).toBe(newer);
	});
});
