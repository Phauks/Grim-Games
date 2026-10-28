/**
 * The live room's stored state across Worker deploys. A room lives in its Durable Object for
 * days, so a deploy can wake a room saved by an older build. Every stored room carries
 * `schemaVersion`; loading runs an older one through `MIGRATIONS`, as saved games do
 * (engine/persistence.ts).
 *
 * To change the stored shape: bump `ROOM_STATE_VERSION`, add the step from the previous
 * version to `MIGRATIONS`, and test the old shape in room-state.test.ts. Production and the
 * beta preview share the room objects, so a room saved by a *newer* build is read as it is:
 * new fields stay optional, and an older build ignores them.
 */
import { newRoom, withoutRequests, type RoomState } from './room.ts';

export const ROOM_STATE_VERSION = 1;

/** Turns a room of version `n` into version `n + 1`. Must not change its input. */
type RoomMigration = (room: RoomState) => RoomState;

/** `MIGRATIONS[n]` takes a room of version `n` to `n + 1`; rooms from before versions are 0. */
const MIGRATIONS: readonly RoomMigration[] = [
	// 0 → 1: requests saved before players joined without approval become names (2026-10-26).
	withoutRequests
];

/** A stored room brought up to the current version; undefined when there is none. */
export function loadRoomState(stored: RoomState | undefined): RoomState | undefined {
	if (!stored) return undefined;
	let room = stored;
	for (let version = room.schemaVersion ?? 0; version < ROOM_STATE_VERSION; version++) {
		room = { ...MIGRATIONS[version](room), schemaVersion: version + 1 };
	}
	return room;
}

/** A new room, stamped with the current version. */
export function newStoredRoom(hostKeyHash: string): RoomState {
	return { ...newRoom(hostKeyHash), schemaVersion: ROOM_STATE_VERSION };
}
