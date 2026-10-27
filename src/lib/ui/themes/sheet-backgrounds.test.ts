import { describe, expect, it } from 'vitest';
import { contrastRatio, resolveToken } from './contrast.ts';
import { grimoire } from './grimoire/theme.ts';
import { SHEET_BACKGROUNDS, SHEET_TOKENS, sheetStyle, sheetTheme } from './sheet-backgrounds.ts';
import { EDGE_PAIRS, SEMANTIC_TOKENS, TEXT_PAIRS } from './types.ts';

// Every sheet background keeps its text readable (WCAG AA, 4.5:1 for body text).
describe('sheet backgrounds', () => {
	for (const background of SHEET_BACKGROUNDS) {
		const tokens = SHEET_TOKENS[background];
		if (!tokens) continue;
		it(`${background}: text, muted text and team colours read on its surface`, () => {
			for (const surface of ['--surface', '--surface-raised'] as const) {
				for (const ink of [
					'--on-surface',
					'--on-surface-muted',
					'--heading',
					'--good',
					'--evil',
					'--good-text',
					'--evil-text',
					'--traveller-text',
					'--loric-text'
				] as const) {
					expect(
						contrastRatio(tokens[ink]!, tokens[surface]!),
						`${ink} on ${surface}`
					).toBeGreaterThanOrEqual(4.5);
				}
			}
			// Character badges are team-coloured fills with their own text.
			for (const fill of ['--good', '--evil'] as const) {
				const on = `--on-${fill.slice(2)}` as const;
				const ink = tokens[on] ?? resolveToken(on, { ...grimoire.palette, ...grimoire.tokens });
				expect(contrastRatio(ink, tokens[fill]!), `text on ${fill}`).toBeGreaterThanOrEqual(4.5);
			}
		});
	}

	it('the theme choice sets no colours of its own', () => {
		expect(sheetStyle('theme')).toBeUndefined();
		expect(sheetStyle('tan')).toContain('--surface: #e9dcc2');
	});
});

// The whole player screen in each background (Trevor, 2026-10-25): every theme check, plus
// what keeps things apart on it (focus ring, alignment pills, tokens) at 3:1 non-text contrast.
describe.each(SHEET_BACKGROUNDS.filter((b) => b !== 'theme'))(
	'player screen in %s',
	(background) => {
		const theme = sheetTheme(background, grimoire)!;
		const table = { ...theme.palette, ...theme.tokens };
		const ratio = (a: string, b: string) =>
			contrastRatio(resolveToken(a, table), resolveToken(b, table));

		it('defines every semantic token and paints one flat page', () => {
			for (const token of SEMANTIC_TOKENS) expect(theme.tokens[token], token).toBeTruthy();
			expect(theme.tokens['--surface-texture']).toBe(theme.tokens['--surface']);
		});

		it.each(TEXT_PAIRS)('%s on %s reaches 4.5:1', (text, bg) => {
			expect(ratio(text, bg)).toBeGreaterThanOrEqual(4.5);
		});

		it.each(EDGE_PAIRS)('%s against %s reaches 3:1', (edge, bg) => {
			expect(ratio(edge, bg)).toBeGreaterThanOrEqual(3);
		});

		it.each(['--surface', '--surface-raised', '--surface-selected'] as const)(
			'the focus ring, and each token by its face or rim, stand out on %s',
			(bg) => {
				expect(ratio('--focus', bg), 'focus').toBeGreaterThanOrEqual(3);
				for (const [face, rim] of [
					['--token-face', '--token-rim'],
					['--reminder-face', '--token-rim']
				] as const) {
					expect(Math.max(ratio(face, bg), ratio(rim, bg)), face).toBeGreaterThanOrEqual(3);
				}
			}
		);

		it('alignment pills keep their text, whatever the paper', () => {
			expect(ratio('--on-good', '--good')).toBeGreaterThanOrEqual(4.5);
			expect(ratio('--on-evil', '--evil')).toBeGreaterThanOrEqual(4.5);
		});
	}
);
