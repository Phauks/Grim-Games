import type { GameId } from '#lib/core/model/index.ts';
import type { SharedGrimoire } from '#lib/core/sync/room.ts';
import {
	reminderCopyIds,
	reminderSpots,
	seatLayouts
} from '#lib/features/grimoire/device-notes.ts';

/** The board's own notes a viewer needs to draw the grimoire as this device does. */
export type BoardNotes = Pick<SharedGrimoire, 'layout' | 'reminderSpots' | 'copies'>;

/** The notes this device keeps for `gameId`, for when the board isn't open to give its own. */
export function storedNotes(gameId: GameId): BoardNotes {
	return {
		layout: seatLayouts.read(gameId),
		reminderSpots: reminderSpots.read(gameId),
		copies: [...reminderCopyIds.read(gameId)]
	};
}
