import type { SeatId } from '#lib/core/model/index.ts';
import { playersDialog } from './players-dialog.svelte.ts';

/**
 * Travellers choose is part of Add seat (Trevor, 2026-11-01: "integrated into the add seat
 * button, when you add a player"), as a pop-up (Trevor, 2026-11-02): the Storyteller picks the
 * new seat's Traveller here, sends the choice to their phone (with a room open), or says Not a
 * Traveller.
 */
export function travellersForNewSeat(seatId: SeatId | undefined, watching: boolean): void {
	if (seatId !== undefined && !watching) playersDialog.showTravellers(seatId);
}
