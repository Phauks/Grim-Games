/** Whether the Storyteller's Messages is open: from the board's ⋯ on every screen. */
class InboxDialog {
	open = $state(false);

	show(): void {
		this.open = true;
	}
}

export const inboxDialog = new InboxDialog();
