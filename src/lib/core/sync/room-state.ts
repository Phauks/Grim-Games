/**
 * The live room's stored state across Worker deploys. A room lives in its Durable Object for
 * days, so a deploy can wake a room saved by another build. Every stored room carries
 * `schemaVersion`, and there are no migrations (Trevor, 2026-11-10): a room saved in an older
 * format is dropped, so its code opens nothing and the Storyteller opens a new room.
 *
 * To change the stored shape: bump `ROOM_STATE_VERSION`. Production and the beta preview share
 * the room objects, so a room saved by a *newer* build is read as it is: new fields stay
 * optional, and an older build ignores them.
 */
import { newRoom, type RoomState } from './room.ts';

export const ROOM_STATE_VERSION = 1;

/** A stored room of this version or newer; undefined when there is none or it is older. */
export function loadRoomState(stored: RoomState | undefined): RoomState | undefined {
	if (!stored || (stored.schemaVersion ?? 0) < ROOM_STATE_VERSION) return undefined;
	return stored;
}

/** A new room, stamped with the current version. */
export function newStoredRoom(hostKeyHash: string): RoomState {
	return { ...newRoom(hostKeyHash), schemaVersion: ROOM_STATE_VERSION };
}
