import type { SeatId } from '#lib/core/model/index.ts';

/** Whether the Storyteller's Players is open: from the board's ⋯ on every screen. */
class PlayersDialog {
	open = $state(false);
	/** A seat whose sheet should open, from its pen mark or its ⋯ Notes. */
	seat = $state<SeatId>();
	/** Count off (plan J40), from the board's ⋯. */
	countOff = $state(false);

	show(): void {
		this.open = true;
	}

	/** Opens Players on one player's sheet, with their notes (Trevor, 2026-10-29). */
	showSeat(seatId: SeatId): void {
		this.open = true;
		this.seat = seatId;
	}
}

export const playersDialog = new PlayersDialog();
