/**
 * The part of the page that fills the screen, if any (Trevor, 2026-10-26: Public Town's town,
 * and the player screen's Grim, 2026-10-27). One at a time; `FullScreenStage` draws it over the
 * app, under every dialog and sheet, so what a tap opens still shows.
 */
class FullScreenPart {
	current = $state.raw<HTMLElement>();
}

export const fullScreenPart = new FullScreenPart();
