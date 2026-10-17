import { describe, expect, it } from 'vitest';
import { boardTokenSize, rememberBoard } from './last-board.svelte.ts';
import { DEFAULT_SEAT_LAYOUT, seatTokenSize } from './seat-layout.ts';

const seats = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

describe('boardTokenSize', () => {
	it('assumes a ten-player board filling the window until a board is drawn', () => {
		const window = { width: 390, height: 700 };
		expect(boardTokenSize(1.5, window)).toBe(
			seatTokenSize(seats(10), DEFAULT_SEAT_LAYOUT, window, 1.5)
		);
	});

	it("then uses the last board's size and seats, ignoring the window", () => {
		const board = { width: 1000, height: 700 };
		rememberBoard({ ...board, seating: seats(6), layout: DEFAULT_SEAT_LAYOUT });
		rememberBoard({ width: 0, height: 0, seating: seats(20), layout: DEFAULT_SEAT_LAYOUT });
		expect(boardTokenSize(1, { width: 320, height: 500 })).toBe(
			seatTokenSize(seats(6), DEFAULT_SEAT_LAYOUT, board, 1)
		);
	});
});
