/**
 * Which version each side of a room runs. The room protocol is the hard floor; above it, the
 * Storyteller's app says when its build was made (Trevor, 2026-10-26: an app older than the
 * Storyteller's is nudged to update, never blocked), and each phone built earlier looks for
 * the newer build so the update card offers Refresh.
 */
import type { RoomState } from './room.ts';

/**
 * The room protocol this build speaks. The Worker updates the moment a build deploys, but an
 * open app keeps its build until the user taps Refresh, so the two can differ for hours.
 * Changes to these messages stay backward compatible (new optional fields only); when one
 * cannot, bump `ROOM_PROTOCOL` and raise `MIN_ROOM_PROTOCOL` so older apps are told to update.
 */
export const ROOM_PROTOCOL = 2;
/**
 * The oldest protocol the room still accepts. 2 (2026-10-22): the room stays open after End
 * game and says the game is over (`game-over`); an older app would show the game as running.
 */
export const MIN_ROOM_PROTOCOL = 2;

/** True when the room still speaks the protocol of the app that said this hello. */
export function supportsProtocol(protocol: unknown): boolean {
	const version = protocol === undefined ? 1 : protocol;
	return typeof version === 'number' && Number.isInteger(version) && version >= MIN_ROOM_PROTOCOL;
}

/** An ISO build time as `build-info.ts` writes it; anything else is ignored. */
export function isBuiltAt(value: unknown): value is string {
	return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

/** The room with the Storyteller's build time, or the same room when it is unchanged or bad. */
export function setStorytellerBuild(room: RoomState, builtAt: unknown): RoomState {
	if (!isBuiltAt(builtAt) || room.storytellerBuiltAt === builtAt) return room;
	return { ...room, storytellerBuiltAt: builtAt };
}

/** True when `theirs` was built after `mine`: a newer build is out there. */
export function isNewerBuild(theirs: string | undefined, mine: string): boolean {
	return isBuiltAt(theirs) && isBuiltAt(mine) && Date.parse(theirs) > Date.parse(mine);
}
