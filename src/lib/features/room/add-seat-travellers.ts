import type { SeatId } from '#lib/core/model/index.ts';
import { roomHost } from './host.svelte.ts';
import { playersDialog } from './players-dialog.svelte.ts';

/**
 * Travellers choose is part of Add seat (Trevor, 2026-11-01: "integrated into the add seat
 * button, when you add a player"): with a room open, the seat just added is ticked in it, so
 * the new player can pick their Traveller on their phone.
 */
export function travellersForNewSeat(seatId: SeatId | undefined, watching: boolean): void {
	if (seatId !== undefined && !watching && roomHost().code) playersDialog.showTravellers(seatId);
}
