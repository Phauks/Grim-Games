/**
 * A players-only game's seats, arranged as the Storyteller arranges the board's (Trevor,
 * 2026-11-15: "In a local only grim, should be able to arrange tokens as desired"): the
 * board's own SeatArranging, with the town kept on this phone (local-town.svelte.ts).
 */
import { moveSeat, placeSeats, swapSeats } from '#lib/core/town/local-town.ts';
import type { SeatTable } from '#lib/features/board/seat-arranging.svelte.ts';
import { DEFAULT_SEAT_LAYOUT, type SeatLayout } from '#lib/ui/seating/seat-layout.ts';
import { localTown, saveLocalTown } from './local-town.svelte.ts';

/** Where the town's seats are drawn: round the ring, but for those the player placed. */
export const localLayout = (notesKey: string): SeatLayout => ({
	...DEFAULT_SEAT_LAYOUT,
	placed: localTown(notesKey).placed ?? {}
});

/** The town under `notesKey` as arranging changes it. */
export function localSeatTable(notesKey: string): SeatTable {
	const save = (change: (town: ReturnType<typeof localTown>) => ReturnType<typeof localTown>) =>
		saveLocalTown(notesKey, change(localTown(notesKey)));
	return {
		setLayout: (layout) => save((town) => placeSeats(town, layout.placed)),
		swap: (a, b) => {
			save((town) => swapSeats(town, a, b));
			return true;
		},
		move: (seatId, position) => save((town) => moveSeat(town, seatId, position))
	};
}
