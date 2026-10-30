import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

/** The board's URL hash that starts adding late players (the bag draw's button). */
export const LATE_PLAYER_HASH = '#late-player';

/** The grimoire, ready to tap where the first late player sits (Trevor, 2026-10-30). */
export function latePlayerHref(gameId: string): ResolvedPathname {
	return `${resolve('/grimoire/[gameId]', { gameId })}${LATE_PLAYER_HASH}` as ResolvedPathname;
}

/** A late player waiting to be confirmed: where they were placed, in today's seating. */
export interface LatePlayer {
	/** Keeps the row while names are typed. */
	key: number;
	position: number;
	name: string;
}
