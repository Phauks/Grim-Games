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
}

export const TILE_FACES = ['numbers', 'symbols'] as const;
export type TileFace = (typeof TILE_FACES)[number];

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const ICON_SCALES = [0.875, 1, 1.25, 1.5] as const;
export type IconScale = (typeof ICON_SCALES)[number];

export const TEXT_ALIGNS = ['left', 'justify'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const DEFAULT_PREFERENCES: Preferences = {
	themeId: DEFAULT_THEME_ID,
	fonts: {},
	textScale: 1,
	iconScale: 1,
	textAlign: 'left',
	iconSet: null,
	iconOverrides: {},
	tokenAppearance: DEFAULT_TOKEN_APPEARANCE,
	assistance: DEFAULT_ASSISTANCE,
	tileFace: 'numbers',
	requireName: false
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
	return {
		themeId: isThemeId(input.themeId) ? input.themeId : DEFAULT_PREFERENCES.themeId,
		fonts: parseFonts(input),
		textScale: (TEXT_SCALES as readonly unknown[]).includes(input.textScale)
			? (input.textScale as TextScale)
			: DEFAULT_PREFERENCES.textScale,
		iconScale: (ICON_SCALES as readonly unknown[]).includes(input.iconScale)
			? (input.iconScale as IconScale)
			: DEFAULT_PREFERENCES.iconScale,
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
			typeof input.requireName === 'boolean' ? input.requireName : DEFAULT_PREFERENCES.requireName
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
