import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFERENCES,
	parsePreferences,
	resolveFonts,
	resolveIcon,
	type Preferences
} from './preferences.ts';
import { ASSIST_PRESETS } from './assistance.ts';
import { grimoire } from './themes/grimoire/theme.ts';

const prefs = (change: Partial<Preferences> = {}): Preferences => ({
	...DEFAULT_PREFERENCES,
	...change
});

describe('parsePreferences', () => {
	it('falls back to defaults for missing or invalid input', () => {
		expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
		expect(parsePreferences('nonsense')).toEqual(DEFAULT_PREFERENCES);
		expect(
			parsePreferences({
				themeId: 'no-such-theme',
				displayFont: 'comic-sans',
				textScale: 7,
				iconSet: 'ph-heavy',
				iconOverrides: { dead: 'ph:not-offered', nope: 'ph:skull' }
			})
		).toEqual(DEFAULT_PREFERENCES);
	});

	it('keeps valid choices', () => {
		const valid = {
			themeId: 'grimoire',
			displayFont: 'im-fell-english-sc',
			textFont: 'lexend',
			textScale: 1.25,
			iconSet: 'ph-fill',
			iconOverrides: { dead: 'ph:cross' },
			assistance: { ...ASSIST_PRESETS.expert }
		};
		expect(parsePreferences(valid)).toEqual(valid);
	});
});

describe('resolution order: user override, then theme, then catalogue', () => {
	it('uses theme fonts unless the user picked one', () => {
		expect(resolveFonts(prefs(), grimoire)).toEqual({ display: 'cinzel', text: 'eb-garamond' });
		expect(resolveFonts(prefs({ textFont: 'lexend' }), grimoire).text).toBe('lexend');
	});

	it('applies the icon weight after the slot override', () => {
		expect(resolveIcon('dead', prefs(), grimoire)).toBe('ph:skull');
		expect(resolveIcon('dead', prefs({ iconSet: 'ph-fill' }), grimoire)).toBe('ph:skull-fill');
		expect(
			resolveIcon(
				'dead',
				prefs({ iconSet: 'ph-bold', iconOverrides: { dead: 'ph:cross' } }),
				grimoire
			)
		).toBe('ph:cross-bold');
		// Not mapped by the theme: the catalogue default.
		expect(resolveIcon('settings', prefs(), grimoire)).toBe('ph:gear');
	});
});
