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
	iconSet: IconSetId | null;
	iconOverrides: Partial<Record<IconSlot, string>>;
	/** How much the app walks the Storyteller through the game. */
	assistance: Assistance;
}

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const DEFAULT_PREFERENCES: Preferences = {
	themeId: DEFAULT_THEME_ID,
	fonts: {},
	textScale: 1,
	iconSet: null,
	iconOverrides: {},
	assistance: DEFAULT_ASSISTANCE
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
		iconSet: isIconSetId(input.iconSet) ? input.iconSet : null,
		iconOverrides,
		assistance: parseAssistance(input.assistance)
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
