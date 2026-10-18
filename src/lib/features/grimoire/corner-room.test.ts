import { describe, expect, it } from 'vitest';
import { cornerRoom } from './corner-room.ts';

const board = { width: 400, height: 600 };

describe('cornerRoom', () => {
	it('takes the whole width when every seat is above the name', () => {
		const seats = [{ x: 100, y: 400, w: 80, h: 80 }];
		expect(cornerRoom(seats, board, 40, 8)).toEqual({ side: 'left', width: 392 });
	});

	it('stops short of a seat that reaches down beside it', () => {
		const seats = [
			{ x: 100, y: 570, w: 80, h: 40 },
			{ x: 380, y: 570, w: 20, h: 40 }
		];
		expect(cornerRoom(seats, board, 40, 8)).toEqual({ side: 'left', width: 52 });
	});

	it('moves to the lower right when that corner has more room', () => {
		const seats = [{ x: 30, y: 580, w: 40, h: 40 }];
		expect(cornerRoom(seats, board, 40, 8)).toEqual({ side: 'right', width: 342 });
	});

	it('has no room when seats fill the bottom edge', () => {
		const seats = [{ x: 200, y: 580, w: 400, h: 40 }];
		expect(cornerRoom(seats, board, 40, 8).width).toBe(0);
	});
});
