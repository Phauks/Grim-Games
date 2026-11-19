/**
 * The dialogs More's Session opens (PaneSession). They live with the board, not the pane's
 * view, so they stay open when a phone's sheet closes under them or the view changes.
 */
class SessionDialogs {
	gameSettings = $state(false);
	transfer = $state(false);
	closeRoom = $state(false);
}

export const sessionDialogs = new SessionDialogs();
