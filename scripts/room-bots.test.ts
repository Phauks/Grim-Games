import { describe, expect, it } from 'vitest';
import { BOT_NAMES, parseTarget } from './room-bots.ts';

describe('room-bots', () => {
	it('reads a room code or a join link', () => {
		expect(parseTarget('482 913')).toEqual({ code: '482913', site: 'https://beta.grimbinder.com' });
		expect(parseTarget('http://localhost:8787/join/482913')).toEqual({
			code: '482913',
			site: 'http://localhost:8787'
		});
		expect(parseTarget('nope')).toBeNull();
	});

	it('has a distinct name for every member a room holds', () => {
		expect(new Set(BOT_NAMES).size).toBe(40);
	});
});
