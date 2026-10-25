import { describe, expect, it } from 'vitest';
import { gamePhase } from './game-phase.ts';

describe('game phase', () => {
	it('is Setup until the first night begins, then Night 1', () => {
		expect(gamePhase(0, { begun: false, nightUnderway: false })).toEqual({ kind: 'setup' });
		expect(gamePhase(0, { begun: true, nightUnderway: false })).toEqual({
			kind: 'night',
			number: 1
		});
		// A night under way has begun, whatever the device's clock says.
		expect(gamePhase(0, { begun: false, nightUnderway: true })).toEqual({
			kind: 'night',
			number: 1
		});
	});

	it('numbers each day as the night before it: Day 3, then Night 4', () => {
		// Begun or not on this device, a game with days played is past Setup.
		expect(gamePhase(3, { begun: false, nightUnderway: false })).toEqual({
			kind: 'day',
			number: 3
		});
		expect(gamePhase(3, { begun: true, nightUnderway: true })).toEqual({
			kind: 'night',
			number: 4
		});
	});
});
