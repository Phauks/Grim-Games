import { describe, expect, it } from 'vitest';
import { ICON_SETS, ICON_SLOTS, isIconChoice, type IconSlot } from '#lib/ui/icons/catalogue.ts';
import { contrastRatio, resolveToken } from './contrast.ts';
import { THEMES } from './registry.ts';
import { SEMANTIC_TOKENS, TEXT_PAIRS } from './types.ts';

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

	it.each(TEXT_PAIRS)('%s on %s reaches WCAG AA (4.5:1)', (text, background) => {
		const ratio = contrastRatio(resolveToken(text, table), resolveToken(background, table));
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it('maps icon slots only to bundled catalogue choices', () => {
		for (const [slot, id] of Object.entries(theme.icons)) {
			expect(isIconChoice(slot as IconSlot, id), `${slot} -> ${id}`).toBe(true);
		}
		expect(ICON_SETS.map((set) => set.id)).toContain(theme.iconSet);
		expect(Object.keys(theme.icons).every((slot) => slot in ICON_SLOTS)).toBe(true);
	});
});
