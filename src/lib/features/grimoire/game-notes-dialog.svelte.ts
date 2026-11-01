/**
 * Whether the board's Game notes are open: from their button beside the grim cover, or from
 * More on phones too narrow for that button (Trevor, 2026-11-01).
 */
class GameNotesDialog {
	open = $state(false);
}

export const gameNotesDialog = new GameNotesDialog();
