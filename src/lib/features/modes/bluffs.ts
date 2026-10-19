import { demonBluffs } from '#lib/core/modes/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { gameModeOf } from './game-mode.ts';

/**
 * Whether the game's Demon learns bluffs: false in a mode without them (Sushi Buffet and
 * Whale Buffet, Trevor 2026-10-18). For the Demon info step and the bluffs sheet.
 */
export function gameHasDemonBluffs(gameId: GameId): boolean {
	const mode = gameModeOf(gameId);
	return mode ? demonBluffs(mode) : true;
}
