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

	it('give the day or night its own eye (Trevor, 2026-10-26)', () => {
		expect(DEFAULT_CORNER_LINES.phase).toBe(true);
		expect(parseCornerLines({ 'game-time': false }).phase).toBe(true);
		expect(parseCornerLines({ 'game-time': false, phase: false })).toMatchObject({
			'game-time': false,
			phase: false
		});
	});
});
