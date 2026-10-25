import { describe, expect, it } from 'vitest';
import type { GameId } from '#lib/core/model/index.ts';
import { clearNextGame, readNextGame, setNextGame, takeNextGame } from './next-game.ts';

const carry = { from: 'old' as GameId, drop: false, names: ['Ana', undefined], at: 1 };

describe('next game carry', () => {
	it('is taken once, by the next game only', () => {
		setNextGame(carry);
		expect(readNextGame()).toEqual(carry);
		expect(takeNextGame()).toEqual(carry);
		expect(takeNextGame()).toBeUndefined();
	});

	it('is gone once the sheet clears it', () => {
		setNextGame(carry);
		clearNextGame();
		expect(takeNextGame()).toBeUndefined();
	});
});
