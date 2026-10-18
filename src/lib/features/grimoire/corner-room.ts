/**
 * Room for the script's name in a bottom corner of the board (Trevor, 2026-10-18: it ran
 * into Seat 4's name on a phone). The name keeps its height; this finds how wide it may be
 * before it reaches a seat or a name, in the lower left corner or else the lower right.
 */
import type { Box } from './name-placement.ts';

export interface CornerRoom {
	side: 'left' | 'right';
	/** How wide the name may be, in px; 0 when neither corner has room. */
	width: number;
}

export function cornerRoom(
	boxes: readonly Box[],
	board: { width: number; height: number },
	/** The name's height, its offset from the edges included. */
	height: number,
	gap: number
): CornerRoom {
	const top = board.height - height;
	const low = boxes.filter((b) => b.y + b.h / 2 > top);
	const left = Math.min(board.width, ...low.map((b) => b.x - b.w / 2)) - gap;
	const right = board.width - Math.max(0, ...low.map((b) => b.x + b.w / 2)) - gap;
	const side = left >= right ? 'left' : 'right';
	return { side, width: Math.max(0, side === 'left' ? left : right) };
}
