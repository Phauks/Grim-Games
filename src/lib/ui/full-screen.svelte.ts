/**
 * The part of the page that fills the screen, if any (Trevor, 2026-10-26: Public Town's town,
 * and the player screen's Grim, 2026-10-27). One at a time; `FullScreenStage` draws it over the
 * app, under every dialog and sheet, so what a tap opens still shows.
 */
class FullScreenPart {
	current = $state.raw<HTMLElement>();
}

export const fullScreenPart = new FullScreenPart();

/**
 * The whole app's full screen, for those who don't know their browser's own way (Trevor,
 * 2026-10-23), from the board's ⋯ menu (Trevor, 2026-10-27: "We can move full screen into ...
 * Menu"). Only where the browser can (iPhone Safari can't for a page), and not in the installed
 * app (Trevor, 2026-10-23): it already has no address bar, and full screen would only take
 * the clock and status bar he wants to keep.
 */
class AppFullScreen {
	#element = $state.raw(typeof document === 'undefined' ? null : document.fullscreenElement);

	constructor() {
		if (typeof document === 'undefined') return;
		document.addEventListener('fullscreenchange', () => {
			this.#element = document.fullscreenElement;
		});
	}

	/** Something on the page fills the screen: the whole app or a part of it. */
	get element(): Element | null {
		return this.#element;
	}

	get available(): boolean {
		return (
			typeof document !== 'undefined' &&
			document.fullscreenEnabled === true &&
			!matchMedia('(display-mode: standalone)').matches
		);
	}

	get on(): boolean {
		return !!this.#element;
	}

	toggle(): void {
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void document.documentElement.requestFullscreen().catch(() => {});
	}
}

export const appFullScreen = new AppFullScreen();
