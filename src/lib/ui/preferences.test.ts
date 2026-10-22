import { describe, expect, it } from 'vitest';
import {
	ICON_SCALE,
	parseScale,
	TEXT_SCALE,
	DEFAULT_PREFERENCES,
	parsePreferences,
	resolveFonts,
	resolveIcon,
	type Preferences
} from './preferences.ts';
import { DEFAULT_ASSISTANCE } from './assistance.ts';
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
				textScale: 'huge',
				iconScale: Number.NaN,
				textAlign: 'center',
				iconSet: 'ph-heavy',
				iconOverrides: { dead: 'ph:not-offered', nope: 'ph:skull' },
				tileFace: 'pictures'
			})
		).toEqual(DEFAULT_PREFERENCES);
	});

	it('keeps valid choices', () => {
		const valid = {
			themeId: 'grimoire',
			fonts: { heading: 'im-fell-english-sc', ability: 'lexend' },
			textScale: 1.25,
			iconScale: 1.5,
			characterIconScale: 0.8,
			textAlign: 'justify',
			allowZoom: true,
			iconSet: 'ph-fill',
			iconOverrides: { dead: 'ph:cross' },
			tokenAppearance: {
				colours: {},
				tokenScale: 1.25,
				reminderScale: 0.75,
				boardNames: true,
				nightNumbers: true,
				nightBadgeScale: 0.75,
				reminderLabelWidth: 2,
				reminderLabelWrap: true,
				inlineReminderScale: 1.5,
				inlineReminderIconScale: 1.25,
				inlineReminderBadgeScale: 0.75,
				inlineNameTextScale: 1.1,
				inlineNameIconScale: 0.9,
				inlineNameBadgeScale: 2,
				reminderLeaves: false,
				setupFlower: true,
				setupMovesName: false
			},
			colors: {},
			assistance: { ...DEFAULT_ASSISTANCE, nightWalkthrough: false },
			tileFace: 'letters',
			requireName: true,
			holdToReveal: true,
			ownWording: true,
			hideWatchLink: true,
			timerSound: 'buzzer',
			timerMode: 'up',
			timerVibrate: false,
			timerKeepAwake: false,
			timerPerPlayer: 45
		};
		expect(parsePreferences(valid)).toEqual(valid);
	});

	it('keeps any bag tile label, and reads an unknown one as numbers', () => {
		expect(parsePreferences({ tileFace: 'random' }).tileFace).toBe('random');
		expect(parsePreferences({ tileFace: 'shapes' }).tileFace).toBe('numbers');
		expect(parsePreferences({ timerSound: 'chime' }).timerSound).toBe('chime');
		expect(parsePreferences({ timerSound: 'gong' }).timerSound).toBe('bell');
		expect(parsePreferences({}).timerVibrate).toBe(true);
		expect(parsePreferences({}).ownWording).toBe(false);
		expect(parsePreferences({ timerVibrate: false }).timerVibrate).toBe(false);
		expect(parsePreferences({}).timerKeepAwake).toBe(true);
		expect(parsePreferences({ timerKeepAwake: 'yes' }).timerKeepAwake).toBe(true);
		expect(parsePreferences({ timerKeepAwake: false }).timerKeepAwake).toBe(false);
		expect(parsePreferences({ timerMode: 'sideways' }).timerMode).toBe('down');
	});

	it('gives character icons the one icon size saved before the split', () => {
		expect(parsePreferences({ iconScale: 1.25 }).characterIconScale).toBe(1.25);
		expect(parsePreferences({ iconScale: 1.25, characterIconScale: 1 }).characterIconScale).toBe(1);
	});
});

describe('size sliders', () => {
	it('snap a saved size to the nearest 5% inside the range', () => {
		expect(parseScale(1.25, TEXT_SCALE)).toBe(1.25);
		// Sizes from the old S/M/L choices.
		expect(parseScale(0.875, TEXT_SCALE)).toBe(0.9);
		expect(parseScale(1.125, TEXT_SCALE)).toBe(1.15);
		expect(parseScale(1.333, ICON_SCALE)).toBe(1.35);
		expect(parseScale(7, TEXT_SCALE)).toBe(1.5);
		expect(parseScale(0.1, ICON_SCALE)).toBe(0.75);
		expect(parseScale('big', TEXT_SCALE)).toBe(1);
	});
});

describe('font roles in saved preferences', () => {
	it('carries an old displayFont to Headings and Character names, and textFont to the rest', () => {
		const old = parsePreferences({ displayFont: 'im-fell-english-sc', textFont: 'lexend' });
		expect(old.fonts).toEqual({
			heading: 'im-fell-english-sc',
			character: 'im-fell-english-sc',
			reminder: 'lexend',
			ability: 'lexend',
			player: 'lexend',
			control: 'lexend',
			body: 'lexend'
		});
		expect(old).not.toHaveProperty('displayFont');
		expect(old).not.toHaveProperty('textFont');
	});

	it('carries over only one of the old keys when the other is missing or invalid', () => {
		expect(parsePreferences({ displayFont: 'cinzel', textFont: 'comic-sans' }).fonts).toEqual({
			heading: 'cinzel',
			character: 'cinzel'
		});
		expect(parsePreferences({ textFont: 'inter' }).fonts).toEqual({
			reminder: 'inter',
			ability: 'inter',
			player: 'inter',
			control: 'inter',
			body: 'inter'
		});
	});

	it('prefers the new per-role fonts over the old keys', () => {
		expect(
			parsePreferences({ fonts: { body: 'inter' }, displayFont: 'cinzel', textFont: 'lexend' })
				.fonts
		).toEqual({ body: 'inter' });
	});

	it('drops unknown roles, unknown fonts and display fonts in running-text roles', () => {
		expect(
			parsePreferences({
				fonts: { ability: 'cinzel', body: 'comic-sans', nope: 'inter', player: 'cinzel' }
			}).fonts
		).toEqual({ player: 'cinzel' });
	});

	it('survives a save and reload', () => {
		const saved = parsePreferences({ textFont: 'lexend' });
		expect(parsePreferences(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
	});
});

describe('resolution order: user override, then theme, then catalogue', () => {
	it('uses theme fonts unless the user picked one', () => {
		expect(resolveFonts(prefs(), grimoire)).toEqual(grimoire.fonts);
		const fonts = resolveFonts(prefs({ fonts: { ability: 'lexend' } }), grimoire);
		expect(fonts.ability).toBe('lexend');
		expect(fonts.heading).toBe(grimoire.fonts.heading);
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
