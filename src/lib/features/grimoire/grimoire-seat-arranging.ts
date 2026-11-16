import { SeatArranging, type ArrangeContext } from '#lib/features/board/seat-arranging.svelte.ts';
import type { Grimoire } from './grimoire.svelte.ts';

/**
 * Arranging the Storyteller's board: its grimoire keeps the game's seats, so each move and
 * swap is in History.
 */
export function grimoireSeatArranging(
	context: () => Omit<ArrangeContext, 'table'> & { grimoire: Grimoire }
): SeatArranging {
	return new SeatArranging(() => {
		const { grimoire, ...rest } = context();
		return {
			...rest,
			table: {
				setLayout: (next) => grimoire.setLayout(next),
				swap: (seatA, seatB) => grimoire.run({ type: 'SwapSeats', seatA, seatB }),
				move: (seatId, position) => void grimoire.run({ type: 'MoveSeat', seatId, position })
			}
		};
	});
}
