import type { Alignment } from '#lib/core/data/index.ts';
import type { EndReason } from '#lib/core/rules/index.ts';

/**
 * A request, from outside the board, to open End game with the winner and how it ended already
 * picked: the Fiddle contest's result (M32c, Trevor, 2026-11-03: the contest is its own screen).
 * The board closes the day sheet over it, and End game takes the request and clears it.
 */
export const endGameRequest = $state<{ pending?: { winner: Alignment; reason: EndReason } }>({});

/** Asks the board to open End game with this winner and how it ended. */
export function requestEndGame(winner: Alignment, reason: EndReason): void {
	endGameRequest.pending = { winner, reason };
}
