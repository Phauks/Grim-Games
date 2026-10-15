import { FONTS, fontStack, loadFont } from '#lib/ui/fonts/catalogue.ts';
import { resolveFonts, type Preferences } from '#lib/ui/preferences.ts';
import type { CssVariable, Theme } from './types.ts';

let written: CssVariable[] = [];

/**
 * Applies a theme and the user's overrides to `<html>` without a reload: sets `data-theme`,
 * writes the theme's palette, semantic and component tokens, then the user's font and text
 * size choices, so user overrides always win.
 */
export function applyAppearance(theme: Theme, prefs: Preferences, root = document.documentElement) {
	const fonts = resolveFonts(prefs, theme);
	const variables: Record<CssVariable, string> = {
		...theme.palette,
		...theme.tokens,
		...theme.components,
		'--font-display': fontStack(fonts.display),
		'--font-display-weight': String(FONTS[fonts.display].displayWeight),
		'--font-text': fontStack(fonts.text),
		'--text-scale': String(prefs.textScale)
	};

	// Clear tokens the previous theme set that this one does not.
	for (const name of written) if (!(name in variables)) root.style.removeProperty(name);
	for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
	written = Object.keys(variables) as CssVariable[];

	root.dataset.theme = theme.id;
	root.style.colorScheme = theme.colorScheme;
	void loadFont(fonts.display);
	void loadFont(fonts.text);
}
