import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

/**
 * Opens a game's board with Export game open (Trevor, 2026-10-26): History's Export goes
 * there, so the picture is always a screenshot of the board itself (screenshot.ts).
 */
export const EXPORT_HASH = '#export';

/** The board of `gameId` with Export game open. */
export function exportHref(gameId: string): ResolvedPathname {
	return `${resolve('/grimoire/[gameId]', { gameId })}${EXPORT_HASH}` as ResolvedPathname;
}
