/**
 * The hidden extra characters rolled for a game (A Script of Infinite Possibilities), kept
 * on this device beside the game so they never reach the game's script, which the players'
 * phones show. Versioned key; anything unreadable rolls again.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const KEY = (gameId: GameId) => `grim-games:mode-extras:v1:${gameId}`;

export function readExtras(gameId: GameId): CharacterId[] | undefined {
	const raw = readStored(KEY(gameId));
	return Array.isArray(raw) && raw.every((id) => typeof id === 'string') ? raw : undefined;
}

export function writeExtras(gameId: GameId, ids: readonly CharacterId[]): void {
	// Storage blocked: the extras still go into this visit's selection.
	writeStored(KEY(gameId), ids);
}
