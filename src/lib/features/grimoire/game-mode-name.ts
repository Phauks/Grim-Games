/**
 * The name of the alternative game mode a game was started in, or undefined for a standard
 * game. Read through the game modes feature (game-mode-store, findMode); shared by the board's
 * corner title and the Resume and History lists (Trevor, 2026-10-18).
 */
import { STANDARD } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from '#lib/features/modes/custom-modes.svelte.ts';
import { readGameMode } from '#lib/features/modes/game-mode-store.ts';

export function gameModeName(gameId: GameId): string | undefined {
	const id = readGameMode(gameId)?.modeId;
	return id && id !== STANDARD.id ? findMode(id)?.name : undefined;
}
