import { demonBluffs } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { findMode } from './custom-modes.svelte.ts';
import { readGameMode } from './game-mode-store.ts';

/**
 * Whether the game's Demon learns bluffs: false in a mode without them (Sushi Buffet and
 * Whale Buffet, Trevor 2026-10-18). For the Demon info step and the bluffs sheet.
 */
export function gameHasDemonBluffs(gameId: GameId): boolean {
	const record = readGameMode(gameId);
	const mode = record && findMode(record.modeId);
	return mode ? demonBluffs(mode) : true;
}
