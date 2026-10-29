import type { Theme } from './types.ts';

/**
 * A screen's own colours in place of the app theme while it is open: the player screen in its
 * sheet background (Trevor, 2026-10-25: "Player screen, sheets follow"). The layout writes it
 * on the page, so the screen's dialogs, sheets and toasts take it too.
 */
class ScreenTheme {
	current = $state.raw<Theme | undefined>();
	/**
	 * Which screen showed `current`, kept outside Svelte's state: a page being torn down during
	 * a move still reads the state as it was before the move, so it can't tell its own theme
	 * from the next page's.
	 */
	#shownBy: object | undefined;

	/**
	 * Shows `theme` and returns what takes it away again. Taking it away leaves a newer screen's
	 * theme alone: on a move between two themed pages the new page is set up before the old one
	 * is torn down, so the old page's cleanup runs last.
	 */
	show(theme: Theme | undefined): () => void {
		const screen = {};
		this.#shownBy = screen;
		this.current = theme;
		return () => {
			if (this.#shownBy !== screen) return;
			this.#shownBy = undefined;
			this.current = undefined;
		};
	}
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
