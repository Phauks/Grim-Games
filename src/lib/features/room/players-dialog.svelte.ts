/** Whether the Storyteller's Players is open: from the board's ⋯ on every screen. */
class PlayersDialog {
	open = $state(false);

	show(): void {
		this.open = true;
	}
}

export const playersDialog = new PlayersDialog();
