import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast.ts';
import { SHEET_BACKGROUNDS, SHEET_TOKENS, sheetStyle } from './sheet-backgrounds.ts';

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
					'--traveller-text',
					'--loric-text'
				] as const) {
					expect(
						contrastRatio(tokens[ink]!, tokens[surface]!),
						`${ink} on ${surface}`
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		});
	}

	it('the theme choice sets no colours of its own', () => {
		expect(sheetStyle('theme')).toBeUndefined();
		expect(sheetStyle('tan')).toContain('--surface: #e9dcc2');
	});
});
