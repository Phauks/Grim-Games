import { describe, expect, it } from 'vitest';
import { iconSlots } from '#lib/ui/icons/catalogue.ts';
import { TILE_SYMBOLS, tileSymbols } from './tile-face.ts';

describe('tileSymbols', () => {
	const ids = Array.from({ length: 20 }, (_, i) => `t${i}`);

	it('gives every tile of a 20-player bag its own symbol', () => {
		expect(new Set(tileSymbols(ids)).size).toBe(20);
	});

	it('is the same for the same bag and differs between bags', () => {
		expect(tileSymbols(ids)).toEqual(tileSymbols(ids));
		expect(tileSymbols(ids.map((id) => `${id}x`))).not.toEqual(tileSymbols(ids));
	});

	it('only uses real icon slots', () => {
		for (const slot of TILE_SYMBOLS) expect(iconSlots).toContain(slot);
	});
});
