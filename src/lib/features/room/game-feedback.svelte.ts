/**
 * Players' feedback on a finished game, saved on the Storyteller's device beside that game
 * (Trevor, 2026-10-25). The room forgets it when the game is reopened or a new one starts;
 * this copy stays until the game is deleted, and reads offline.
 */
import {
	mergeFeedback,
	parseSavedFeedback,
	savedFeedback,
	type SavedFeedbackEntry
} from '#lib/core/feedback/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

const KEY = (gameId: GameId) => `grim-games:game-feedback:${gameId}`;

/** Bumped on every save, so an open feedback dialog reads again. */
let saves = $state(0);

export const gameFeedback = {
	read(gameId: GameId): SavedFeedbackEntry[] {
		void saves;
		return readParsed(KEY(gameId), parseSavedFeedback);
	},
	/** Saves what the room sent on `gameId` with what is already saved. */
	save(gameId: GameId, incoming: readonly unknown[]): void {
		const before = readParsed(KEY(gameId), parseSavedFeedback);
		const after = mergeFeedback(before, incoming);
		if (JSON.stringify(after) === JSON.stringify(before)) return;
		if (writeStored(KEY(gameId), savedFeedback(after))) saves += 1;
	},
	forget(gameId: GameId): void {
		writeStored(KEY(gameId), undefined);
		saves += 1;
	}
};
