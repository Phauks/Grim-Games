/**
 * Live games (plan J31, Trevor 2026-10-26): admins see every open room and can watch any of
 * them, read-only and unseen. The Storyteller and the phones are never told: an admin's socket
 * is in no member list, no count of who is here and no count of watchers.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { PublicPhase } from './public-projection.ts';
import { roomPreview, type RoomPreview } from './room-preview.ts';
import type { RoomState } from './room.ts';

/** The admins' list of open rooms; signed-out and other accounts get 404. */
export const LIVE_GAMES_API = '/api/admin/games';

/** An admin's read-only socket to one room. */
export function liveGamePath(code: string): string {
	return `${LIVE_GAMES_API}/${code}`;
}

/** The room code in a live game's path, or undefined for any other path. */
export function parseLiveGamePath(pathname: string): string | undefined {
	return pathname.match(/^\/api\/admin\/games\/([0-9]{6})$/)?.[1];
}

/** One open room, as the admins' list shows it. */
export interface LiveGame {
	code: string;
	/** When the room last had a connection or a change (milliseconds since the epoch). */
	active: number;
	/** What a phone sees before joining: the script, the Storyteller, seats and who sits. */
	preview: RoomPreview;
	/** Phones connected now. */
	phones: number;
	/** Night, day or setup, once the Storyteller's board is open. */
	phase?: PublicPhase;
}

export interface LiveGameList {
	games: LiveGame[];
}

export function liveGame(
	code: string,
	room: RoomState,
	script: Script | undefined,
	phones: number,
	active: number
): LiveGame {
	const game: LiveGame = {
		code,
		active,
		preview: roomPreview(room, script),
		phones
	};
	const phase = room.public?.corner?.phase;
	if (phase) game.phase = phase;
	return game;
}

/** Most recently active first. */
export function sortLiveGames(games: readonly LiveGame[]): LiveGame[] {
	return [...games].sort((a, b) => b.active - a.active);
}
