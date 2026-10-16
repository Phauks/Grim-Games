import { describe, expect, it } from 'vitest';
import { grimoire } from '#lib/ui/themes/grimoire/theme.ts';
import {
	MIN_CONTRAST,
	parseTokenAppearance,
	tokenColour,
	tokenContrast,
	tokenVariables
} from './token-appearance.ts';

// Colours from the theme's palette: hex literals belong in src/lib/ui/themes only.
const PALE = grimoire.palette['--palette-parchment-50'];
const DARK = grimoire.palette['--palette-ink-900'];
const LIGHT_TEXT = grimoire.palette['--palette-parchment-200'];

describe('token appearance', () => {
	it('keeps only valid colours and sizes', () => {
		expect(
			parseTokenAppearance({
				colours: { face: PALE.toUpperCase(), reminder: 'red', ink: 'rgb(1 2 3)', other: DARK },
				tokenScale: 1.5,
				reminderScale: 3
			})
		).toEqual({ colours: { face: PALE.toLowerCase() }, tokenScale: 1.5, reminderScale: 1 });
		expect(parseTokenAppearance(null)).toEqual({ colours: {}, tokenScale: 1, reminderScale: 1 });
	});

	it('writes the sizes and only the changed colours; text colours both kinds of token', () => {
		expect(
			tokenVariables({ colours: { ink: DARK }, tokenScale: 1.25, reminderScale: 0.75 })
		).toEqual({
			'--token-scale': '1.25',
			'--reminder-scale': '0.75',
			'--on-token': DARK,
			'--on-reminder': DARK
		});
	});

	it('falls back to the theme colours', () => {
		const defaults = parseTokenAppearance({});
		expect(tokenColour('reminder', defaults, grimoire)).toBe(PALE);
		expect(tokenColour('face', { ...defaults, colours: { face: DARK } }, grimoire)).toBe(DARK);
	});

	it('the theme defaults read clearly; a pale text on pale faces does not', () => {
		const defaults = parseTokenAppearance({});
		const ok = tokenContrast(defaults, grimoire);
		expect(ok.face).toBeGreaterThanOrEqual(MIN_CONTRAST);
		expect(ok.reminder).toBeGreaterThanOrEqual(MIN_CONTRAST);
		const poor = tokenContrast({ ...defaults, colours: { ink: LIGHT_TEXT } }, grimoire);
		expect(poor.reminder).toBeLessThan(MIN_CONTRAST);
	});
});
