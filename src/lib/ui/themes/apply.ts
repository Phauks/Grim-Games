import {
	FONT_ROLE_INFO,
	FONT_ROLES,
	FONTS,
	fontStack,
	fontVariable,
	fontWeightVariable,
	loadFont
} from '#lib/ui/fonts/catalogue.ts';
import { resolveFonts, type Preferences } from '#lib/ui/preferences.ts';
import { tokenVariables } from '#lib/ui/token/token-appearance.ts';
import type { CssVariable, Theme } from './types.ts';

let written: CssVariable[] = [];

/** `--font-<role>` for every role, plus `--font-<role>-weight` for the short-text roles. */
export function fontVariables(theme: Theme, prefs: Preferences): Record<CssVariable, string> {
	const fonts = resolveFonts(prefs, theme);
	const variables: Record<CssVariable, string> = {};
	for (const role of FONT_ROLES) {
		variables[fontVariable(role)] = fontStack(fonts[role]);
		if (FONT_ROLE_INFO[role].length === 'short') {
			variables[fontWeightVariable(role)] = String(FONTS[fonts[role]].displayWeight);
		}
	}
	return variables;
}

/**
 * Applies a theme and the user's overrides to `<html>` without a reload: sets `data-theme`,
 * writes the theme's palette, semantic and component tokens, then the user's font and text
 * size choices, so user overrides always win.
 */
export function applyAppearance(theme: Theme, prefs: Preferences, root = document.documentElement) {
	const variables: Record<CssVariable, string> = {
		...theme.palette,
		...theme.tokens,
		...theme.components,
		...prefs.colors,
		...tokenVariables(prefs.tokenAppearance),
		...fontVariables(theme, prefs),
		'--text-scale': String(prefs.textScale),
		'--icon-scale': String(prefs.iconScale),
		'--character-icon-scale': String(prefs.characterIconScale),
		'--text-align': prefs.textAlign === 'justify' ? 'justify' : 'start'
	};

	// Clear tokens the previous theme set that this one does not.
	for (const name of written) if (!(name in variables)) root.style.removeProperty(name);
	for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
	written = Object.keys(variables) as CssVariable[];

	root.dataset.theme = theme.id;
	root.dataset.textAlign = prefs.textAlign;
	root.style.colorScheme = theme.colorScheme;
	// Only the fonts in use are fetched; Settings loads the rest for its previews.
	for (const font of new Set(Object.values(resolveFonts(prefs, theme)))) void loadFont(font);
}
