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
		).toEqual({
			colours: { face: PALE.toLowerCase() },
			tokenScale: 1.5,
			reminderScale: 2,
			boardNames: false,
			nightNumbers: false,
			nightBadgeScale: 1,
			reminderLabelWidth: 1.5,
			reminderLabelWrap: false,
			inlineReminderScale: 1,
			inlineReminderIcons: true
		});
		expect(parseTokenAppearance(null)).toEqual({
			colours: {},
			tokenScale: 1,
			reminderScale: 1,
			boardNames: false,
			nightNumbers: false,
			nightBadgeScale: 1,
			reminderLabelWidth: 1.5,
			reminderLabelWrap: false,
			inlineReminderScale: 1,
			inlineReminderIcons: true
		});
		expect(parseTokenAppearance({ boardNames: true }).boardNames).toBe(true);
		expect(parseTokenAppearance({ boardNames: 'yes' }).boardNames).toBe(false);
		expect(parseTokenAppearance({ nightNumbers: true, nightBadgeScale: 1.33 })).toMatchObject({
			nightNumbers: true,
			nightBadgeScale: 1.35
		});
		expect(
			parseTokenAppearance({ reminderLabelWidth: 2.1, reminderLabelWrap: true })
		).toMatchObject({ reminderLabelWidth: 2, reminderLabelWrap: true });
		expect(parseTokenAppearance({ reminderLabelWidth: 9 }).reminderLabelWidth).toBe(3);
		expect(
			parseTokenAppearance({ inlineReminderScale: 1.33, inlineReminderIcons: false })
		).toMatchObject({ inlineReminderScale: 1.35, inlineReminderIcons: false });
		expect(parseTokenAppearance({ reminderLabelWidth: 'wide' }).reminderLabelWidth).toBe(1.5);
		// Earlier builds' name placements are dropped: the player name is always a badge now.
		expect(
			parseTokenAppearance({ playerNamePlacement: 'below', namePlacement: 'icon-top' })
		).toEqual(parseTokenAppearance({}));
	});

	it('keeps sizes on the 50% to 200% range in 5% steps; old S/M/L/XL sizes keep', () => {
		const scale = (raw: unknown) => parseTokenAppearance({ tokenScale: raw }).tokenScale;
		expect([0.75, 1, 1.25, 1.5].map(scale)).toEqual([0.75, 1, 1.25, 1.5]);
		expect(scale(0.77)).toBe(0.75);
		expect(scale(1.33)).toBe(1.35);
		expect(scale(0.1)).toBe(0.5);
		expect(scale('big')).toBe(1);
	});

	it('writes the sizes and only the changed colours; text colours both kinds of token', () => {
		expect(
			tokenVariables({
				colours: { ink: DARK },
				tokenScale: 1.25,
				reminderScale: 0.75,
				boardNames: true,
				nightNumbers: true,
				nightBadgeScale: 1.5,
				reminderLabelWidth: 2.5,
				reminderLabelWrap: true,
				inlineReminderScale: 1.5,
				inlineReminderIcons: false
			})
		).toEqual({
			'--token-scale': '1.25',
			'--reminder-scale': '0.75',
			'--night-badge-scale': '1.5',
			'--reminder-label-width': '2.5',
			'--reminder-label-wrap': 'normal',
			'--reminder-label-min': 'min-content',
			'--inline-reminder-scale': '1.5',
			'--inline-reminder-owner': 'none',
			'--inline-reminder-dot': 'block',
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
