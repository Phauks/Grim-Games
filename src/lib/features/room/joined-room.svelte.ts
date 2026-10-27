import type { RoomPlayer } from './player.svelte.ts';

/**
 * The room this phone is in while a player screen shows it, for the Your name row in
 * Settings > Player (Trevor, 2026-10-27: one Settings everywhere, the player cog opens it).
 * Settings opened anywhere else has no room, so no name to change.
 */
let current = $state.raw<RoomPlayer>();

export const joinedRoom = {
	get player(): RoomPlayer | undefined {
		return current;
	},
	/** Shows this room's name row in Settings; the returned function takes it away. */
	set(next: RoomPlayer): () => void {
		current = next;
		return () => {
			if (current === next) current = undefined;
		};
	}
};
