import { describe, expect, it } from 'vitest';
import { DEFAULT_CORNER_LINES, parseCornerLines } from './corner-lines.ts';

describe('board corner lines', () => {
	it('start as the corner was: everything but the version and players', () => {
		expect(parseCornerLines(undefined)).toEqual(DEFAULT_CORNER_LINES);
		expect(DEFAULT_CORNER_LINES.version).toBe(false);
		expect(DEFAULT_CORNER_LINES.players).toBe(false);
		expect(DEFAULT_CORNER_LINES['join-code']).toBe(true);
	});

	it('keep saved eyes and ignore anything else', () => {
		const lines = parseCornerLines({ author: false, version: true, other: true, rules: 'no' });
		expect(lines.author).toBe(false);
		expect(lines.version).toBe(true);
		expect(lines.rules).toBe(true);
		expect(lines).not.toHaveProperty('other');
	});

	it('carry over the old Board switches the first time', () => {
		expect(parseCornerLines(undefined, { roomCode: false })['join-code']).toBe(false);
		const both = { gameClock: false, boardPhase: false };
		expect(parseCornerLines(undefined, both)['game-time']).toBe(false);
		expect(parseCornerLines(undefined, { gameClock: false })['game-time']).toBe(true);
		// Once saved, the eyes win over the old switches.
		expect(parseCornerLines({ 'join-code': true }, { roomCode: false })['join-code']).toBe(true);
	});
});
