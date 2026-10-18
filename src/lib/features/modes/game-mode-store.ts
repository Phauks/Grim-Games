/**
 * The game mode a game was started in, with the Storyteller's own restrictions, kept on this
 * device beside the game (like seat layouts, device-notes.ts) so the game's event log and its
 * saved format don't change. The key carries a version; anything unreadable reads as a
 * standard game.
 */
import type { GameId } from '#lib/core/model/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import type { StorytellerRestrictions } from '#lib/core/modes/index.ts';

export interface GameModeRecord {
	modeId: string;
	restrictions: StorytellerRestrictions;
	/** Role Recycling for a draft (Sushi Buffet): unchosen characters go back in the pool. The
	 * Storyteller's choice on New game; left out, the mode's own setting. */
	roleRecycling?: boolean;
}

const KEY = (gameId: GameId) => `grim-games:game-mode:v1:${gameId}`;

const ids = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export function readGameMode(gameId: GameId): GameModeRecord | undefined {
	const raw = readStored(KEY(gameId));
	if (!raw || typeof raw !== 'object') return undefined;
	const r = raw as Partial<GameModeRecord>;
	if (typeof r.modeId !== 'string') return undefined;
	return {
		modeId: r.modeId,
		restrictions: { banned: ids(r.restrictions?.banned), allowed: ids(r.restrictions?.allowed) },
		...(typeof r.roleRecycling === 'boolean' ? { roleRecycling: r.roleRecycling } : {})
	};
}

export function writeGameMode(gameId: GameId, record: GameModeRecord): void {
	// Storage full or blocked: the game itself is saved; only the mode label is lost.
	writeStored(KEY(gameId), record);
}
