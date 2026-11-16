/**
 * A players-only game's seats, arranged as the Storyteller arranges the board's (Trevor,
 * 2026-11-15: "In a local only grim, should be able to arrange tokens as desired"): the
 * board's own SeatArranging, with the town kept on this phone (local-town.svelte.ts).
 */
import { moveSeat, placeSeats, swapSeats } from '#lib/core/town/local-town.ts';
import { SeatArranging, type SeatTable } from '#lib/features/board/seat-arranging.svelte.ts';
import {
	DEFAULT_SEAT_LAYOUT,
	type BoardSize,
	type SeatLayout,
	type SeatPoint
} from '#lib/ui/seating/seat-layout.ts';
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

/** What the Grim tab's town gives arranging, fresh on each call. */
interface LocalBoard {
	/** The town's notebook key; none outside a players-only game. */
	local: string | undefined;
	seats: readonly { seatId: string }[];
	layout: SeatLayout;
	/** Each seat's centre, in % of the town. */
	points: SeatPoint[];
	size: number;
	board: BoardSize;
	townEl: HTMLElement | undefined;
	/** The town above the reminder tray, where the ring (and so the layout) is drawn. */
	ring: BoardSize;
}

/** Arranging for the Grim tab's town, the board's own (`SeatArranging`). */
export function localArranging(read: () => LocalBoard): SeatArranging {
	return new SeatArranging(() => {
		const { local, seats, layout, points, size, board, townEl, ring } = read();
		return {
			table: localSeatTable(local ?? ''),
			seating: seats.map((s) => s.seatId),
			layout,
			points,
			size,
			board,
			element: townEl,
			toLayout: (p) => ({
				x: p.x,
				y: ring.height > 0 ? (p.y * board.height) / ring.height : p.y
			})
		};
	});
}
