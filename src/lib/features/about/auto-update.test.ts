import { describe, expect, it } from 'vitest';
import {
	AWAY_MS,
	takesUpdateAfterAway,
	takesUpdateOnNavigate,
	type Screen
} from './auto-update.svelte.ts';

const home: Screen = { inGame: false, reloadLoses: false, dialogOpen: false };
const board: Screen = { inGame: true, reloadLoses: false, dialogOpen: false };
const bagDraw: Screen = { inGame: true, reloadLoses: true, dialogOpen: false };

// Trevor (2026-10-27): a downloaded build takes over by itself when that interrupts nothing.
describe('taking a downloaded build by itself', () => {
	it('takes it on the way to another page outside a game', () => {
		expect(takesUpdateOnNavigate(true, home, false)).toBe(true);
		expect(takesUpdateOnNavigate(true, { ...home, dialogOpen: true }, false)).toBe(true);
	});

	it('leaves a game, the same page, and a build not yet downloaded alone', () => {
		expect(takesUpdateOnNavigate(true, board, false)).toBe(false);
		expect(takesUpdateOnNavigate(true, home, true)).toBe(false);
		expect(takesUpdateOnNavigate(false, home, false)).toBe(false);
	});

	it('takes it after a while in the background, a game board included', () => {
		expect(takesUpdateAfterAway(true, AWAY_MS, home)).toBe(true);
		expect(takesUpdateAfterAway(true, AWAY_MS, board)).toBe(true);
		expect(takesUpdateAfterAway(true, AWAY_MS - 1, board)).toBe(false);
		expect(takesUpdateAfterAway(false, AWAY_MS, home)).toBe(false);
	});

	it('never reloads a bag draw or an open dialog from the background', () => {
		expect(takesUpdateAfterAway(true, AWAY_MS * 10, bagDraw)).toBe(false);
		expect(takesUpdateAfterAway(true, AWAY_MS * 10, { ...board, dialogOpen: true })).toBe(false);
	});
});
