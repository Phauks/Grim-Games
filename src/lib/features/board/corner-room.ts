/**
 * Room for the script's name in the board's lower left corner (Trevor, 2026-10-18: it ran
 * into Seat 4's name on a phone; and it stays in that corner whatever the token size). The
 * name keeps its height; this finds how wide it may be before it reaches a seat or a name.
 */
import type { Box } from './name-placement.ts';

/** How wide the name may be, in px; 0 when the corner has no room. */
export function cornerRoom(
	boxes: readonly Box[],
	board: { width: number; height: number },
	/** The name's height, its offset from the edges included. */
	height: number,
	gap: number
): number {
	const top = board.height - height;
	const low = boxes.filter((b) => b.y + b.h / 2 > top);
	return Math.max(0, Math.min(board.width, ...low.map((b) => b.x - b.w / 2)) - gap);
}
