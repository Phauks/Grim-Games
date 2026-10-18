/**
 * The hidden extra characters rolled for a game (A Script of Infinite Possibilities), kept
 * on this device beside the game so they never reach the game's script, which the players'
 * phones show. Versioned key; anything unreadable rolls again.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';

const KEY = (gameId: GameId) => `grim-games:mode-extras:v1:${gameId}`;

export function readExtras(gameId: GameId): CharacterId[] | undefined {
	try {
		const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY(gameId)) ?? 'null');
		return Array.isArray(raw) && raw.every((id) => typeof id === 'string') ? raw : undefined;
	} catch {
		return undefined;
	}
}

export function writeExtras(gameId: GameId, ids: readonly CharacterId[]): void {
	try {
		globalThis.localStorage?.setItem(KEY(gameId), JSON.stringify(ids));
	} catch {
		// Storage blocked: the extras still go into this visit's selection.
	}
}
