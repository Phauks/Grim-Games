import { isFontId, type FontId } from '#lib/ui/fonts/catalogue.ts';
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
import { DEFAULT_THEME_ID, isThemeId } from '#lib/ui/themes/registry.ts';
import type { Theme } from '#lib/ui/themes/types.ts';

/**
 * Per-device look-and-feel preferences (04-architecture.md §9). Separate from game state
 * and never synced to rooms. `null` means "use the theme's default".
 */
export interface Preferences {
	themeId: string;
	displayFont: FontId | null;
	textFont: FontId | null;
	textScale: TextScale;
	iconSet: IconSetId | null;
	iconOverrides: Partial<Record<IconSlot, string>>;
}

export const TEXT_SCALES = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const DEFAULT_PREFERENCES: Preferences = {
	themeId: DEFAULT_THEME_ID,
	displayFont: null,
	textFont: null,
	textScale: 1,
	iconSet: null,
	iconOverrides: {}
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
		displayFont: isFontId(input.displayFont) ? input.displayFont : null,
		textFont: isFontId(input.textFont) ? input.textFont : null,
		textScale: (TEXT_SCALES as readonly unknown[]).includes(input.textScale)
			? (input.textScale as TextScale)
			: DEFAULT_PREFERENCES.textScale,
		iconSet: isIconSetId(input.iconSet) ? input.iconSet : null,
		iconOverrides
	};
}

export function resolveFonts(prefs: Preferences, theme: Theme): { display: FontId; text: FontId } {
	return {
		display: prefs.displayFont ?? theme.fonts.display,
		text: prefs.textFont ?? theme.fonts.text
	};
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
