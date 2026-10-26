import type { Theme } from './types.ts';

/**
 * A screen's own colours in place of the app theme while it is open: the player screen in its
 * sheet background (Trevor, 2026-10-25: "Player screen, sheets follow"). The layout writes it
 * on the page, so the screen's dialogs, sheets and toasts take it too.
 */
class ScreenTheme {
	current = $state<Theme | undefined>();
}

export const screenTheme = new ScreenTheme();

/**
 * A theme's own colours as inline custom properties, for the part of a themed screen the whole
 * table shares: the town on the players' Grim tab keeps the board's colours whatever sheet
 * background a player picked (Trevor, 2026-10-26). The element also carries
 * `data-board-colours`, so the component tokens (components.css) resolve against them there.
 */
export function themeColours(theme: Theme): string {
	return Object.entries({ ...theme.tokens, ...theme.components })
		.map(([name, value]) => `${name}: ${value}`)
		.join('; ');
}
