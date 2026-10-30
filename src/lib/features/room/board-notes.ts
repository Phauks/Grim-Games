import { migrateSavedGame, withGameId } from '#lib/core/engine/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import type { SharedGrimoire } from '#lib/core/sync/room.ts';
import { gameStore } from '#lib/features/game/session.svelte.ts';
import {
	parseReminderCopyIds,
	parseReminderSpots,
	reminderCopyIds,
	reminderSpots,
	seatLayouts
} from '#lib/features/grimoire/device-notes.ts';
import { parseSeatLayout } from '#lib/ui/seating/seat-layout.ts';

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

/**
 * Saves a grimoire from another device on this one, with where that device drew its seats and
 * reminders: a room's game brought by a transfer, under its own id so the players' seats, notes
 * and guesses carry on, or a game sent with a report, under `gameId` so it never replaces one of
 * this device's games. Its id, or undefined when this build can't read it (saved by a newer one).
 */
export async function keepGrimoire(
	grimoire: Pick<SharedGrimoire, 'saved' | keyof BoardNotes>,
	gameId?: GameId
): Promise<GameId | undefined> {
	try {
		const read = migrateSavedGame(grimoire.saved);
		const saved = gameId === undefined ? read : withGameId(read, gameId);
		await gameStore().save(saved);
		const id = saved.gameId as GameId;
		if (grimoire.layout !== undefined) seatLayouts.write(id, parseSeatLayout(grimoire.layout));
		reminderSpots.write(id, parseReminderSpots(grimoire.reminderSpots));
		reminderCopyIds.write(id, parseReminderCopyIds(grimoire.copies));
		return id;
	} catch {
		return undefined;
	}
}
