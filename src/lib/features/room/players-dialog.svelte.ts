import type { SeatId } from '#lib/core/model/index.ts';

/** Whether the Storyteller's Players is open: from the board's ⋯ on every screen. */
class PlayersDialog {
	open = $state(false);
	/** A seat whose sheet should open, from its pen mark or its ⋯ Notes. */
	seat = $state<SeatId>();
	/** Count off (plan J40), from the board's ⋯. */
	countOff = $state(false);
	/** Travellers choose on their phones, from Add seat or a choosing seat's sheet. */
	travellers = $state(false);
	/** The seat just added, ticked in the Travellers form (or added to the open choice). */
	travellerSeat = $state<SeatId>();

	show(): void {
		this.open = true;
	}

	/**
	 * Travellers choose, as part of Add seat (Trevor, 2026-11-01: "integrated into the add seat
	 * button, when you add a player"), or to watch an open choice.
	 */
	showTravellers(seatId?: SeatId): void {
		this.travellerSeat = seatId;
		this.travellers = true;
	}

	/** Opens Players on one player's sheet, with their notes (Trevor, 2026-10-29). */
	showSeat(seatId: SeatId): void {
		this.open = true;
		this.seat = seatId;
	}
}

export const playersDialog = new PlayersDialog();
