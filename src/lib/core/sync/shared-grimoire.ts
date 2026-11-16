/**
 * The grimoire a Storyteller's device sends whole: to the phones it gave Grim view while the
 * game runs, and to the room's phones once it is over (Share grim, R5). Split from room.ts.
 */
import type { RoomState } from './room.ts';

/**
 * The Storyteller's whole grimoire, for Grim view (Trevor, 2026-10-18: Specters spectators
 * watch the grimoire, after promising not to spoil the game). Only the Storyteller's device
 * sends it and only the members it named (`grimViewers`) receive it; the room relays it as
 * given, and each phone checks `saved` as a saved game before showing it.
 */
export interface SharedGrimoire {
	/** The game as the Storyteller's device saves it (`SavedGame`). */
	saved: Record<string, unknown>;
	/** Where that device draws the seats, and its reminders' spots and copies (device notes). */
	layout?: unknown;
	reminderSpots?: unknown;
	copies?: unknown;
	/** The day timer as it is on that device (`SharedDayTimer`), so spectators see it run. */
	timer?: unknown;
	/** The board's background as that device shows it (`PublicLook`), drawn the same here. */
	look?: unknown;
	/** That board's shape, its width ÷ height, so seats keep its places round the ring. */
	aspect?: unknown;
	/**
	 * Each seated player's own picture by seat (`seatPictures`), so a board drawn elsewhere shows
	 * them as the Storyteller's does (Trevor, 2026-11-15: avatars missing on the view-only grim).
	 */
	pictures?: unknown;
	/**
	 * The table as phones in the room get it (`PublicGameState`) and how the game ended, so a
	 * spectator's player view shows the same status row (Trevor, 2026-11-15).
	 */
	table?: unknown;
	ended?: unknown;
}

/** A whole game's history with a homebrew script: well above `MAX_SCRIPT_BYTES`. */
export const MAX_GRIMOIRE_BYTES = 1024 * 1024;

/** A light shape check of a grimoire for viewers: they check the saved game themselves. */
export function isSharedGrimoire(value: unknown): value is SharedGrimoire {
	if (typeof value !== 'object' || value === null) return false;
	const { saved } = value as { saved?: unknown };
	return typeof saved === 'object' && saved !== null && !Array.isArray(saved);
}

/** The members with Grim view, as still in the room. */
export function grimViewersOf(room: RoomState): string[] {
	const ids = room.grimViewers ?? [];
	return ids.filter((id) => room.members.some((m) => m.memberId === id));
}

/** Gives Grim view to exactly these members (Trevor, 2026-11-16); anything else is ignored. */
export function setGrimViewers(room: RoomState, members: unknown): RoomState {
	if (!Array.isArray(members)) return room;
	const { grimViewers: _old, ...rest } = room;
	void _old;
	const ids = room.members.flatMap((m) => (members.includes(m.memberId) ? [m.memberId] : []));
	return ids.length ? { ...rest, grimViewers: ids } : rest;
}
