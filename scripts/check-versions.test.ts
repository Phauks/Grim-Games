import { describe, expect, it } from 'vitest';
import { lowered, readVersion } from './check-versions.ts';

describe('check-versions', () => {
	it('reads the number a source sets', () => {
		expect(readVersion('export const SAVED_GAME_VERSION = 32;', 'SAVED_GAME_VERSION')).toBe(32);
		expect(readVersion('export const MIN_ROOM_PROTOCOL = 2;', 'ROOM_PROTOCOL')).toBeUndefined();
	});

	it('names a number that went down, and only that', () => {
		expect(lowered({ SAVED_GAME_VERSION: 32 }, { SAVED_GAME_VERSION: 31 })).toEqual([
			'SAVED_GAME_VERSION went down from 32 to 31; it never goes down.'
		]);
		expect(lowered({ SAVED_GAME_VERSION: 32 }, { SAVED_GAME_VERSION: 33 })).toEqual([]);
		expect(lowered({ ROOM_PROTOCOL: undefined }, { ROOM_PROTOCOL: 2 })).toEqual([]);
	});
});
