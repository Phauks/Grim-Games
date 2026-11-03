/** The number token's symbol (plan M35): `#` and a number from 0 to 20. */
import { describe, expect, it } from 'vitest';
import { isNumberSymbol, numberSymbol, symbolNumber } from './types.ts';

describe('number symbols', () => {
	it('reads back the number it was written with', () => {
		for (const n of [0, 1, 9, 20]) expect(symbolNumber(numberSymbol(n))).toBe(n);
	});

	it('is no number for other symbols, or out of range', () => {
		for (const symbol of [undefined, '', '🦉', 'ph:skull', '#', '#21', '#1a', '3'])
			expect(symbolNumber(symbol)).toBeUndefined();
		expect(isNumberSymbol('#21')).toBe(true);
		expect(isNumberSymbol('🦉')).toBe(false);
	});
});
