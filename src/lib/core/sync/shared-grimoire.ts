/**
 * The grimoire a Storyteller's device sends whole: to the view-only link while the game runs,
 * and to the room's phones once it is over (Share grim, R5). Split from room.ts.
 */

/**
 * The Storyteller's whole grimoire, for the view-only link (Trevor, 2026-10-18: Specters
 * spectators watch the grimoire, after promising not to spoil the game). Only the
 * Storyteller's device sends it and only viewers with the link's key receive it; the room
 * relays it as given, and each viewer checks `saved` as a saved game before showing it.
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
}

/** A whole game's history with a homebrew script: well above `MAX_SCRIPT_BYTES`. */
export const MAX_GRIMOIRE_BYTES = 1024 * 1024;

/** A light shape check of a grimoire for viewers: they check the saved game themselves. */
export function isSharedGrimoire(value: unknown): value is SharedGrimoire {
	if (typeof value !== 'object' || value === null) return false;
	const { saved } = value as { saved?: unknown };
	return typeof saved === 'object' && saved !== null && !Array.isArray(saved);
}
