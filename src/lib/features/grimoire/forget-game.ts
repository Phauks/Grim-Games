import type { GameId } from '#lib/core/model/index.ts';
import { gameStore } from '#lib/features/game/session.svelte.ts';
import { gameFeedback } from '#lib/features/room/game-feedback.svelte.ts';
import { endedGames, seatLayouts } from './device-notes.ts';

/** Removes a saved game from this device, with the notes kept beside it. */
export async function forgetGame(gameId: GameId): Promise<void> {
	await gameStore().delete(gameId);
	seatLayouts.forget(gameId);
	endedGames.reopen(gameId);
	gameFeedback.forget(gameId);
}
