/**
 * The game's length on the board (Trevor, 2026-10-23): from the first night to the end.
 */
import { describe, expect, it } from 'vitest';
import { formatGameLength, gameLength } from './game-clock.ts';

describe('game clock', () => {
	it('runs from the start to now, or to the end once the game is over', () => {
		expect(gameLength(1_000, 61_000)).toBe(60_000);
		expect(gameLength(1_000, 999_000, 31_000)).toBe(30_000);
		expect(gameLength(5_000, 1_000)).toBe(0);
	});

	it('reads m:ss under an hour and h:mm:ss after, rounding down', () => {
		expect(formatGameLength(0)).toBe('0:00');
		expect(formatGameLength(59_999)).toBe('0:59');
		expect(formatGameLength(61_000)).toBe('1:01');
		expect(formatGameLength(3_600_000)).toBe('1:00:00');
		expect(formatGameLength(2 * 3_600_000 + 5 * 60_000 + 7_000)).toBe('2:05:07');
	});
});
