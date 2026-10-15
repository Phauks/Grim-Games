import { grimoire } from './grimoire/theme.ts';
import type { Theme } from './types.ts';

/** Every theme the Settings picker offers. Adding a theme is a new folder plus one line here. */
export const THEMES: readonly Theme[] = [grimoire];

export const DEFAULT_THEME_ID = grimoire.id;

export function getTheme(id: string | null | undefined): Theme {
	return THEMES.find((theme) => theme.id === id) ?? grimoire;
}

export function isThemeId(value: unknown): value is string {
	return THEMES.some((theme) => theme.id === value);
}
