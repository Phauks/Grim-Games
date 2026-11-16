import type { SeatId } from '#lib/core/model/index.ts';
import { sidePane } from './side-pane.svelte.ts';

/**
 * The Storyteller's Players, now the Players tab of the board's pane (plan M86), and the
 * dialogs Players opens.
 */
class PlayersDialog {
	/** A seat whose sheet should open, from its note mark. */
	seat = $state<SeatId>();
	/** Count off (plan J40), from the board's ⋯. */
	countOff = $state(false);
	/** Travellers choose on their phones, from an arriving or choosing seat's sheet. */
	travellers = $state(false);
	/** The seat asked about, ticked in the Travellers form (or added to the open choice). */
	travellerSeat = $state<SeatId>();
	/** Not a Traveller goes on to the seat's own character picker. */
	notTraveller: (() => void) | undefined;

	show(): void {
		sidePane.show('players');
	}

	/**
	 * Travellers choose for a seat added mid-game, from its empty token (Trevor, 2026-11-02), or
	 * to watch an open choice.
	 */
	showTravellers(seatId?: SeatId, notTraveller?: () => void): void {
		this.notTraveller = notTraveller;
		this.travellerSeat = seatId;
		this.travellers = true;
	}

	/** Opens Players on one player's sheet, with their notes (Trevor, 2026-10-29). */
	showSeat(seatId: SeatId): void {
		this.seat = seatId;
		sidePane.show('players');
	}
}

export const playersDialog = new PlayersDialog();
