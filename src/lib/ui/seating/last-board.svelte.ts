/**
 * The last grimoire board drawn on this device this session: its measured size, seats and
 * layout. The token size preview in Settings uses it to draw tokens at the size the board
 * gives them (Trevor, 2026-10-17: the preview didn't match the size in play).
 */
import { DEFAULT_SEAT_LAYOUT, seatTokenSize, type SeatLayout } from './seat-layout.ts';

interface BoardMetrics {
	width: number;
	height: number;
	seating: readonly string[];
	layout: SeatLayout;
}

let last = $state<BoardMetrics | undefined>(undefined);

export function rememberBoard(metrics: BoardMetrics): void {
	if (metrics.width > 0 && metrics.height > 0) last = metrics;
}

/** Seats assumed before any board has been drawn: a typical game. */
const TYPICAL_SEATS = Array.from({ length: 10 }, (_, i) => `seat-${i}`);

/**
 * The size the board draws a seat's token at, for a Token size setting: the last board's,
 * or before one has been drawn, a ten-player board filling the window.
 */
export function boardTokenSize(scale: number, viewport: { width: number; height: number }): number {
	if (last) return seatTokenSize(last.seating, last.layout, last, scale);
	return seatTokenSize(TYPICAL_SEATS, DEFAULT_SEAT_LAYOUT, viewport, scale);
}
