/** The number token's symbol (plan M35): `#` and a number from 0 to 20. */
import { describe, expect, it } from 'vitest';
import {
	characterSymbol,
	isNumberSymbol,
	isPresetColour,
	isSymbolColour,
	numberSymbol,
	symbolCharacter,
	symbolNumber
} from './types.ts';
import type { CharacterId } from '#lib/core/data/index.ts';

/** A picked colour as data, `#` and its digits (written so, it reads as no style colour). */
const hex = (digits: string) => `#${digits}` as const;

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

describe('character icon symbols (Trevor, 2026-11-10)', () => {
	it('names the character whose icon it shows', () => {
		const imp = 'imp' as CharacterId;
		expect(symbolCharacter(characterSymbol(imp))).toBe(imp);
		for (const symbol of [undefined, '', '@', '🦉', 'ph:skull', '#3'])
			expect(symbolCharacter(symbol)).toBeUndefined();
	});
});

describe('symbol colours (Trevor, 2026-11-10: presets and full custom)', () => {
	it('is a preset or a picked #rrggbb', () => {
		expect(isSymbolColour('red')).toBe(true);
		expect(isSymbolColour(hex('a1b2c3'))).toBe(true);
		for (const colour of ['pink', hex('A1B2C3'), hex('abc'), '', undefined, 3])
			expect(isSymbolColour(colour)).toBe(false);
		expect(isPresetColour('gold')).toBe(true);
		expect(isPresetColour(hex('a1b2c3'))).toBe(false);
	});
});
