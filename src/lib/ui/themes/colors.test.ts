import { describe, expect, it } from 'vitest';
import { COLOR_TOKENS, contrastWarnings, parseColors, themeColor } from './colors.ts';
import { grimoire } from './grimoire/theme.ts';

describe('custom theme colours', () => {
	it('every exposed token resolves to a solid colour in every theme', () => {
		for (const token of COLOR_TOKENS) expect(themeColor(grimoire, token)).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('keeps only known tokens with hex colours', () => {
		expect(
			parseColors({ '--surface': '#ABCDEF', '--border': '#000000', '--good': 'red', x: 1 })
		).toEqual({ '--surface': '#abcdef' });
	});

	// The good blue and evil red never change (Trevor, 2026-10-28), so a saved one is dropped.
	it('never lets a team colour be changed', () => {
		expect(
			parseColors({ '--good': '#00ff00', '--evil': '#00ff00', '--on-good': '#000000' })
		).toEqual({});
	});

	// Nor the Fabled gold or Loric green (Trevor, 2026-10-29).
	it('never lets a Fabled or Loric colour be changed', () => {
		expect(parseColors({ '--fabled': '#00ff00', '--loric': '#00ff00' })).toEqual({});
	});

	it('warns about a custom pair under 4.5:1, and only for custom colours', () => {
		expect(contrastWarnings(grimoire, {}, '--surface')).toEqual([]);
		const warnings = contrastWarnings(grimoire, { '--surface': '#efe2c4' }, '--surface');
		expect(warnings.map((w) => w.text)).toContain('--on-surface');
		expect(warnings.every((w) => w.ratio < 4.5)).toBe(true);
	});
});
