import { describe, expect, it } from 'vitest';
import { DEFAULT_CORNER_LINES } from './corner-lines.ts';
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

	it('reads an icon picked under a slot’s old name', () => {
		expect(parsePreferences({ iconOverrides: { rename: 'ph:user-switch' } }).iconOverrides).toEqual(
			{ edit: 'ph:user-switch' }
		);
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
				nightLeaves: 'numbers',
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
				setupMovesName: false,
				reminderHighlight: false,
				reminderHighlightLook: 'both',
				tokenIconScale: 0.9,
				reminderIconScale: 1.2
			},
			colors: {},
			assistance: { ...DEFAULT_ASSISTANCE, nightWalkthrough: false },
			cornerLines: { ...DEFAULT_CORNER_LINES, version: true },
			tileFace: 'letters',
			requireName: true,
			holdToReveal: true,
			slotMachine: true,
			tileOrderRandom: true,
			ownWording: true,
			hideWatchLink: true,
			soundVolume: 0.35,
			timerSound: 'buzzer',
			timerMode: 'up',
			timerVibrate: false,
			callSound: 'buzzer',
			timerKeepAwake: false,
			timerPerPlayer: 45,
			timerForPlayers: 'timer',
			coverPin: true,
			qrCentre: 'picture',
			qrPictureWhole: true,
			qrPictureZoom: 1.5,
			qrPictureCorners: 'circle',
			qrModules: 'dot',
			qrFinders: 'rounded'
		};
		expect(parsePreferences(valid)).toEqual(valid);
		// Shapes it doesn't know, and a zoom out of range, fall back (Trevor, 2026-10-23).
		expect(
			parsePreferences({
				qrModules: 'stars',
				qrFinders: 7,
				qrPictureZoom: 9,
				qrPictureCorners: 'x'
			})
		).toMatchObject({
			qrModules: 'square',
			qrFinders: 'square',
			qrPictureZoom: 2,
			qrPictureCorners: 'rounded'
		});
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

	// Plan U1: one volume for every sound, silent to full, saved by older builds as nothing.
	it('reads the sound volume inside its range, full when unknown', () => {
		expect(parsePreferences({}).soundVolume).toBe(1);
		expect(parsePreferences({ soundVolume: 0 }).soundVolume).toBe(0);
		expect(parsePreferences({ soundVolume: 0.42 }).soundVolume).toBe(0.4);
		expect(parsePreferences({ soundVolume: 3 }).soundVolume).toBe(1);
		expect(parsePreferences({ soundVolume: 'loud' }).soundVolume).toBe(1);
		// Plan U2: the Back to town sound, the clock tower by default.
		expect(parsePreferences({}).callSound).toBe('clocktower');
		expect(parsePreferences({ callSound: 'gong' }).callSound).toBe('clocktower');
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
