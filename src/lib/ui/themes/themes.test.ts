import { describe, expect, it } from 'vitest';
import { ICON_SETS, ICON_SLOTS, isIconChoice, type IconSlot } from '#lib/ui/icons/catalogue.ts';
import { contrastRatio, resolveToken } from './contrast.ts';
import { THEMES } from './registry.ts';
import { FIXED_COLORS } from './team-colors.ts';
import { EDGE_PAIRS, SEMANTIC_TOKENS, TEXT_PAIRS } from './types.ts';

describe('contrast helpers', () => {
	it('match the WCAG reference values', () => {
		expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#777', '#fff')).toBeCloseTo(4.48, 2);
	});
});

describe.each(THEMES.map((theme) => [theme.id, theme] as const))('theme %s', (_, theme) => {
	const table = { ...theme.palette, ...theme.tokens };

	it('defines every semantic token', () => {
		for (const token of SEMANTIC_TOKENS) expect(theme.tokens[token], token).toBeTruthy();
	});

	// The good blue and evil red are the same in every theme (Trevor, 2026-10-28).
	it('uses the fixed team colours', () => {
		for (const [token, color] of Object.entries(FIXED_COLORS)) {
			expect(resolveToken(token, table), token).toBe(color);
		}
		for (const token of Object.keys(FIXED_COLORS)) {
			expect(theme.components ?? {}, token).not.toHaveProperty(token);
		}
	});

	it.each(TEXT_PAIRS)('%s on %s reaches WCAG AA (4.5:1)', (text, background) => {
		const ratio = contrastRatio(resolveToken(text, table), resolveToken(background, table));
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it.each(EDGE_PAIRS)('%s against %s reaches 3:1 (non-text contrast)', (edge, background) => {
		const ratio = contrastRatio(resolveToken(edge, table), resolveToken(background, table));
		expect(ratio).toBeGreaterThanOrEqual(3);
	});

	it('maps icon slots only to bundled catalogue choices', () => {
		for (const [slot, id] of Object.entries(theme.icons)) {
			expect(isIconChoice(slot as IconSlot, id), `${slot} -> ${id}`).toBe(true);
		}
		expect(ICON_SETS.map((set) => set.id)).toContain(theme.iconSet);
		expect(Object.keys(theme.icons).every((slot) => slot in ICON_SLOTS)).toBe(true);
	});
});
