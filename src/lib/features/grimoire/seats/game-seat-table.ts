import type { SeatTable } from '#lib/features/board/seat-arranging.svelte.ts';
import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

/** The game's seats as arranging keeps them: each move and swap is in History. */
export const gameSeatTable = (grimoire: Grimoire): SeatTable => ({
	setLayout: (next) => grimoire.setLayout(next),
	swap: (seatA, seatB) => grimoire.run({ type: 'SwapSeats', seatA, seatB }),
	move: (seatId, position) => void grimoire.run({ type: 'MoveSeat', seatId, position })
});
