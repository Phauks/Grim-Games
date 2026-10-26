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
