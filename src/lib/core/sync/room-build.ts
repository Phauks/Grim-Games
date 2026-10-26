/**
 * Which build each side of a room runs (Trevor, 2026-10-26: an app older than the
 * Storyteller's is nudged to update, never blocked). The Storyteller's app says when its
 * build was made; each phone compares that with its own and, when it is behind, looks for
 * the newer build so the update card offers Refresh.
 */
import type { RoomState } from './room.ts';

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
