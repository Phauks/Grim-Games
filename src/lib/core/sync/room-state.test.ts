import { describe, expect, it } from 'vitest';
import { newRoom, type RoomState } from './room.ts';
import { loadRoomState, newStoredRoom, ROOM_STATE_VERSION } from './room-state.ts';

describe('stored room versions', () => {
	it('stamps a new room with the current version', () => {
		expect(newStoredRoom('hash').schemaVersion).toBe(ROOM_STATE_VERSION);
		expect(loadRoomState(undefined)).toBeUndefined();
	});

	it('drops a room from before versions instead of converting it', () => {
		const old: RoomState = newRoom('hash');
		expect(loadRoomState(old)).toBeUndefined();
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
