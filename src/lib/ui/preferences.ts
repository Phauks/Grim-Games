import { FONT_ROLES, isFontFor, type FontId, type FontRole } from '#lib/ui/fonts/catalogue.ts';
import {
	ICON_SETS,
	ICON_SLOTS,
	iconSlots,
	isIconChoice,
	isIconSetId,
	withWeight,
	type IconSetId,
	type IconSlot
} from '#lib/ui/icons/catalogue.ts';
import { DEFAULT_ASSISTANCE, parseAssistance, type Assistance } from '#lib/ui/assistance.ts';
import { DEFAULT_THEME_ID, isThemeId } from '#lib/ui/themes/registry.ts';
import {
	DEFAULT_TOKEN_APPEARANCE,
	parseTokenAppearance,
	type TokenAppearance
} from '#lib/ui/token/token-appearance.ts';
import type { Theme } from '#lib/ui/themes/types.ts';

/**
 * Per-device look-and-feel preferences (04-architecture.md §9). Separate from game state
 * and never synced to rooms. `null` means "use the theme's default".
 */
export interface Preferences {
	themeId: string;
	/** The user's font for each role; a missing role uses the theme's font. */
	fonts: Partial<Record<FontRole, FontId>>;
	textScale: TextScale;
	/** Multiplies the size of interface icons; independent of text size. */
	iconScale: IconScale;
	/** Multiplies the size of character art in badges and lists (Trevor, 2026-10-16), not tokens. */
	characterIconScale: IconScale;
	/** How paragraphs of body text line up: ragged right, or justified to both edges. */
	textAlign: TextAlign;
	iconSet: IconSetId | null;
	iconOverrides: Partial<Record<IconSlot, string>>;
	/** Character token and reminder token sizes, and any token colours the user changed. */
	tokenAppearance: TokenAppearance;
	/** How much the app walks the Storyteller through the game. */
	assistance: Assistance;
	/** What face-down bag tiles show on the draw screen. */
	tileFace: TileFace;
	/**
	 * A player types their name before they can see the token they drew, in the
	 * pass-the-phone draw and when drawing on their own phone (Trevor, 2026-10-16).
	 */
	requireName: boolean;
	/** The sound when the day timer runs out (Trevor, 2026-10-17). */
	timerSound: TimerSound;
	/** The day timer counts down to 0:00 or up past its target (Trevor, 2026-10-17). */
	timerMode: TimerMode;
	/** The device vibrates when the day timer runs out (Trevor, 2026-10-18). */
	timerVibrate: boolean;
}

export const TIMER_MODES = ['down', 'up'] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

/** The day timer's finishing sounds, made on the device (no audio files); or none. */
export const TIMER_SOUNDS = ['bell', 'chime', 'clocktower', 'buzzer', 'none'] as const;
export type TimerSound = (typeof TIMER_SOUNDS)[number];

/**
 * Numbers or letters (Trevor, 2026-10-16). The random symbols this replaced read back as
 * the default, numbers.
 */
export const TILE_FACES = ['numbers', 'letters', 'symbols', 'colours', 'emoji', 'random'] as const;
export type TileFace = (typeof TILE_FACES)[number];

/** A size as a fraction of normal (1 = 100%), chosen on a slider (Trevor, 2026-10-16). */
export interface ScaleRange {
	min: number;
	max: number;
	step: number;
}

/** Text size: 75% to 150% in 5% steps; 150% is the largest the layouts are tested at. */
export const TEXT_SCALE: ScaleRange = { min: 0.75, max: 1.5, step: 0.05 };
/** Icon size, same range as text. */
export const ICON_SCALE: ScaleRange = { min: 0.75, max: 1.5, step: 0.05 };

export type TextScale = number;
export type IconScale = number;

/**
 * A stored size snapped to its slider: the nearest step, inside the range. Sizes saved by
 * older builds (0.875, 1.125 from the S/M/L choices) become the nearest 5%.
 */
export function parseScale(input: unknown, range: ScaleRange, fallback = 1): number {
	if (typeof input !== 'number' || !Number.isFinite(input)) return fallback;
	const clamped = Math.min(range.max, Math.max(range.min, input));
	const steps = Math.round((clamped - range.min) / range.step);
	return Math.round((range.min + steps * range.step) * 1000) / 1000;
}

export const TEXT_ALIGNS = ['left', 'justify'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const DEFAULT_PREFERENCES: Preferences = {
	themeId: DEFAULT_THEME_ID,
	fonts: {},
	textScale: 1,
	iconScale: 1,
	characterIconScale: 1,
	textAlign: 'left',
	iconSet: null,
	iconOverrides: {},
	tokenAppearance: DEFAULT_TOKEN_APPEARANCE,
	assistance: DEFAULT_ASSISTANCE,
	tileFace: 'numbers',
	requireName: false,
	timerSound: 'bell',
	timerMode: 'down',
	timerVibrate: true
};

/** Builds valid preferences from anything (old versions, hand edits, garbage). */
export function parsePreferences(raw: unknown): Preferences {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const overrides = (
		input.iconOverrides && typeof input.iconOverrides === 'object' ? input.iconOverrides : {}
	) as Record<string, unknown>;
	const iconOverrides: Preferences['iconOverrides'] = {};
	for (const slot of iconSlots) {
		const id = overrides[slot];
		if (isIconChoice(slot, id)) iconOverrides[slot] = id;
	}
	const iconScale = parseScale(input.iconScale, ICON_SCALE, DEFAULT_PREFERENCES.iconScale);
	return {
		themeId: isThemeId(input.themeId) ? input.themeId : DEFAULT_PREFERENCES.themeId,
		fonts: parseFonts(input),
		textScale: parseScale(input.textScale, TEXT_SCALE, DEFAULT_PREFERENCES.textScale),
		iconScale,
		// Saved before the split, the one icon size applied to both.
		characterIconScale: parseScale(input.characterIconScale, ICON_SCALE, iconScale),
		textAlign: (TEXT_ALIGNS as readonly unknown[]).includes(input.textAlign)
			? (input.textAlign as TextAlign)
			: DEFAULT_PREFERENCES.textAlign,
		iconSet: isIconSetId(input.iconSet) ? input.iconSet : null,
		iconOverrides,
		tokenAppearance: parseTokenAppearance(input.tokenAppearance),
		assistance: parseAssistance(input.assistance),
		tileFace: (TILE_FACES as readonly unknown[]).includes(input.tileFace)
			? (input.tileFace as TileFace)
			: DEFAULT_PREFERENCES.tileFace,
		requireName:
			typeof input.requireName === 'boolean' ? input.requireName : DEFAULT_PREFERENCES.requireName,
		timerSound: (TIMER_SOUNDS as readonly unknown[]).includes(input.timerSound)
			? (input.timerSound as TimerSound)
			: DEFAULT_PREFERENCES.timerSound,
		timerMode: (TIMER_MODES as readonly unknown[]).includes(input.timerMode)
			? (input.timerMode as TimerMode)
			: DEFAULT_PREFERENCES.timerMode,
		timerVibrate:
			typeof input.timerVibrate === 'boolean'
				? input.timerVibrate
				: DEFAULT_PREFERENCES.timerVibrate
	};
}

/** Roles the two fonts of older builds (`displayFont`, `textFont`) covered. */
const LEGACY_DISPLAY_ROLES: readonly FontRole[] = ['heading', 'character'];

/**
 * Per-role fonts. Older builds saved one `displayFont` (titles and character names) and one
 * `textFont` (everything else); those carry over to the matching roles when `fonts` is absent.
 */
function parseFonts(input: Record<string, unknown>): Preferences['fonts'] {
	const fonts: Preferences['fonts'] = {};
	if (input.fonts && typeof input.fonts === 'object') {
		const saved = input.fonts as Record<string, unknown>;
		for (const role of FONT_ROLES) {
			const font = saved[role];
			if (isFontFor(role, font)) fonts[role] = font;
		}
		return fonts;
	}
	for (const role of FONT_ROLES) {
		const legacy = LEGACY_DISPLAY_ROLES.includes(role) ? input.displayFont : input.textFont;
		if (isFontFor(role, legacy)) fonts[role] = legacy;
	}
	return fonts;
}

/** The font for every role: the user's choice, else the theme's. */
export function resolveFonts(prefs: Preferences, theme: Theme): Record<FontRole, FontId> {
	return Object.fromEntries(
		FONT_ROLES.map((role) => [role, prefs.fonts[role] ?? theme.fonts[role]])
	) as Record<FontRole, FontId>;
}

export function resolveIconSet(prefs: Preferences, theme: Theme): IconSetId {
	return prefs.iconSet ?? theme.iconSet;
}

/** The base id for a slot before a weight is applied: override -> theme -> catalogue. */
export function resolveIconBase(slot: IconSlot, prefs: Preferences, theme: Theme): string {
	return prefs.iconOverrides[slot] ?? theme.icons[slot] ?? ICON_SLOTS[slot].choices[0];
}

/** The full Iconify id to draw for a slot, e.g. `dead` -> `ph:skull-fill`. */
export function resolveIcon(slot: IconSlot, prefs: Preferences, theme: Theme): string {
	const set = ICON_SETS.find((s) => s.id === resolveIconSet(prefs, theme)) ?? ICON_SETS[0];
	return withWeight(resolveIconBase(slot, prefs, theme), set.weight);
}
