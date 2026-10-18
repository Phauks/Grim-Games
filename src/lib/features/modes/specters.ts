import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';

/** Whether the game's mode gives spectators a vote (Specters), for a link from its board. */
export function hasSpectatorVote(gameId: GameId): boolean {
	const record = readGameMode(gameId);
	const mode = record && findMode(record.modeId);
	return mode?.parts.daySteps?.some((s) => s.kind === 'spectator-vote') === true;
}
