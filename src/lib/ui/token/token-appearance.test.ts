import { describe, expect, it } from 'vitest';
import { grimoire } from '#lib/ui/themes/grimoire/theme.ts';
import {
	DEFAULT_TOKEN_APPEARANCE,
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
			...DEFAULT_TOKEN_APPEARANCE,
			colours: { face: PALE.toLowerCase() },
			tokenScale: 1.5,
			reminderScale: 2
		});
		expect(parseTokenAppearance(null)).toEqual(DEFAULT_TOKEN_APPEARANCE);
		expect(parseTokenAppearance({ boardNames: true }).boardNames).toBe(true);
		expect(parseTokenAppearance({ boardNames: 'yes' }).boardNames).toBe(false);
		expect(parseTokenAppearance({ nightLeaves: 'off', nightBadgeScale: 1.33 })).toMatchObject({
			nightLeaves: 'off',
			nightBadgeScale: 1.35
		});
		expect(parseTokenAppearance({ nightLeaves: 'wide' }).nightLeaves).toBe('leaves');
		// Earlier builds' night order numbers switch: on keeps the numbers on the leaves.
		expect(parseTokenAppearance({ nightNumbers: true }).nightLeaves).toBe('numbers');
		expect(parseTokenAppearance({ nightNumbers: false }).nightLeaves).toBe('leaves');
		expect(
			parseTokenAppearance({ reminderLabelWidth: 2.1, reminderLabelWrap: true })
		).toMatchObject({ reminderLabelWidth: 2, reminderLabelWrap: true });
		expect(parseTokenAppearance({ reminderLabelWidth: 9 }).reminderLabelWidth).toBe(3);
		expect(parseTokenAppearance({ inlineReminderScale: 1.33 }).inlineReminderScale).toBe(1.35);
		expect(parseTokenAppearance({ reminderLeaves: false, setupFlower: true })).toMatchObject({
			reminderLeaves: false,
			setupFlower: true
		});
		// The flower leaves the name in place unless asked (Trevor, 2026-10-19).
		expect(parseTokenAppearance({}).setupMovesName).toBe(false);
		expect(parseTokenAppearance({ setupMovesName: true }).setupMovesName).toBe(true);
		// Reminder highlight (Trevor, 2026-10-20): on, ring.
		expect(parseTokenAppearance({})).toMatchObject({
			reminderHighlight: true,
			reminderHighlightLook: 'ring'
		});
		expect(parseTokenAppearance({ reminderHighlightLook: 'sparkle' })).toMatchObject({
			reminderHighlightLook: 'ring'
		});
		// The owner's icon colour setting is dropped: always the owner's alignment (Trevor,
		// 2026-10-23), so a saved one is forgotten.
		expect(parseTokenAppearance({ reminderIconColour: 'plain' })).toEqual(parseTokenAppearance({}));
		// The old global ∞ fill switch is dropped: each ∞ token has its own (Trevor, 2026-10-23).
		expect(parseTokenAppearance({ genericIconFill: true })).toEqual(parseTokenAppearance({}));
		// Character icon sizes (Trevor, 2026-10-23): kept on 50% to 125%, else 100%.
		expect(parseTokenAppearance({}).tokenIconScale).toBe(1);
		expect(parseTokenAppearance({ tokenIconScale: 1.1 }).tokenIconScale).toBe(1.1);
		expect(parseTokenAppearance({ reminderIconScale: 3 }).reminderIconScale).toBe(1.25);
		expect(parseTokenAppearance({ reminderIconScale: 'big' }).reminderIconScale).toBe(1);
		// Earlier builds' dot instead of the owner's icon is dropped (Trevor, 2026-10-18).
		expect(parseTokenAppearance({ inlineReminderIcons: false })).toEqual(parseTokenAppearance({}));
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

	it('writes the reminder highlight as a ring, a glow, both or neither', () => {
		const lit = (look: Partial<typeof DEFAULT_TOKEN_APPEARANCE>) => {
			const v = tokenVariables({ ...DEFAULT_TOKEN_APPEARANCE, ...look });
			return [v['--reminder-lit-ring'] !== 'none', v['--reminder-lit-glow'] !== 'none'];
		};
		expect(lit({ reminderHighlightLook: 'ring' })).toEqual([true, false]);
		expect(lit({ reminderHighlightLook: 'glow' })).toEqual([false, true]);
		expect(lit({ reminderHighlightLook: 'both' })).toEqual([true, true]);
		expect(lit({ reminderHighlight: false, reminderHighlightLook: 'both' })).toEqual([
			false,
			false
		]);
	});

	it('writes the sizes and only the changed colours, each to its own variable', () => {
		expect(
			tokenVariables({
				...DEFAULT_TOKEN_APPEARANCE,
				colours: { ink: DARK, rim: DARK, reminderLabel: PALE },
				tokenScale: 1.25,
				reminderScale: 0.75,
				nightBadgeScale: 1.5,
				reminderLabelWidth: 2.5,
				reminderLabelWrap: true,
				inlineReminderScale: 1.5,
				inlineReminderIconScale: 0.5,
				inlineReminderBadgeScale: 2,
				inlineNameTextScale: 1.25,
				inlineNameIconScale: 1.75,
				inlineNameBadgeScale: 0.75
			})
		).toEqual({
			'--token-scale': '1.25',
			'--reminder-scale': '0.75',
			'--token-icon': '1',
			'--reminder-icon': '1',
			'--night-badge-scale': '1.5',
			'--reminder-label-width': '2.5',
			'--reminder-label-wrap': 'normal',
			'--reminder-label-min': 'min-content',
			'--inline-reminder-scale': '1.5',
			'--inline-reminder-icon': '0.5',
			'--inline-reminder-badge': '2',
			'--inline-name-text': '1.25',
			'--inline-name-icon': '1.75',
			'--inline-name-badge': '0.75',
			'--reminder-lit-ring': '0.2rem solid var(--accent)',
			'--reminder-lit-glow': 'none',
			'--on-token': DARK,
			'--token-face-shade': DARK,
			'--reminder-label-face': PALE
		});
	});

	it('names and reminders in text keep their own sizes', () => {
		// Trevor (2026-10-18): text, icon and badge sizes "are all different to me".
		expect(
			parseTokenAppearance({
				inlineNameTextScale: 1.33,
				inlineNameIconScale: 2,
				inlineNameBadgeScale: 9,
				inlineReminderIconScale: 0.5,
				inlineReminderBadgeScale: 'big'
			})
		).toMatchObject({
			inlineNameTextScale: 1.35,
			inlineNameIconScale: 2,
			inlineNameBadgeScale: 2,
			inlineReminderIconScale: 0.5,
			inlineReminderBadgeScale: 1
		});
	});

	it('an older single text colour becomes the reminder text colour too', () => {
		expect(parseTokenAppearance({ colours: { ink: DARK } }).colours).toEqual({
			ink: DARK,
			reminderInk: DARK
		});
		expect(
			parseTokenAppearance({ colours: { ink: DARK, reminderInk: PALE } }).colours.reminderInk
		).toBe(PALE);
		// Once saved by this build, the reminder text keeps the theme's colour.
		const saved = parseTokenAppearance({ ...DEFAULT_TOKEN_APPEARANCE, colours: { ink: DARK } });
		expect(saved.colours).toEqual({ ink: DARK });
	});

	it('falls back to the theme colours', () => {
		const defaults = parseTokenAppearance({});
		expect(tokenColour('reminder', defaults, grimoire)).toBe(PALE);
		expect(tokenColour('face', { ...defaults, colours: { face: DARK } }, grimoire)).toBe(DARK);
		// The reminder's text band follows its face until it has its own colour.
		expect(tokenColour('reminderLabel', defaults, grimoire)).toBe(PALE);
		expect(
			tokenColour('reminderLabel', { ...defaults, colours: { reminder: DARK } }, grimoire)
		).toBe(DARK);
	});

	it('the theme defaults read clearly; a pale text on pale faces does not', () => {
		const defaults = parseTokenAppearance({});
		const ok = tokenContrast(defaults, grimoire);
		expect(ok.face).toBeGreaterThanOrEqual(MIN_CONTRAST);
		expect(ok.reminder).toBeGreaterThanOrEqual(MIN_CONTRAST);
		const poor = tokenContrast({ ...defaults, colours: { reminderInk: LIGHT_TEXT } }, grimoire);
		expect(poor.reminder).toBeLessThan(MIN_CONTRAST);
		// A dark band under pale words is still poor while the face stays pale.
		const band = tokenContrast(
			{ ...defaults, colours: { reminderInk: LIGHT_TEXT, reminderLabel: DARK } },
			grimoire
		);
		expect(band.reminder).toBeLessThan(MIN_CONTRAST);
	});
});
