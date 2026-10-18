/**
 * Characters a mode always has in play (Two Towns and a Boomdandy: "Boomdandy and Mayor are
 * guaranteed to be in play", https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/)
 * go into the game's setup selection once, the first time its setup opens from here. The
 * Storyteller can still take one out: it is never put back.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { GameId } from '#lib/core/model/index.ts';
import { setupSelection } from '#lib/features/setup/selection.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const KEY = (gameId: GameId) => `grim-games:mode-in-play:v1:${gameId}`;

export function seedInPlay(gameId: GameId, players: number, ids: readonly CharacterId[]): void {
	if (ids.length === 0 || readStored(KEY(gameId)) === true) return;
	setupSelection.open(gameId, players);
	for (const id of ids) if (setupSelection.copies(id) === 0) setupSelection.setCopies(id, 1);
	// Storage blocked: seeded again next visit, which only re-adds what the mode requires.
	writeStored(KEY(gameId), true);
}
