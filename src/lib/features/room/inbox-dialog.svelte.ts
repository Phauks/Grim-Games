/** Whether the Storyteller's Messages is open: from the board's toolbar, or ⋯ on a phone. */
class InboxDialog {
	open = $state(false);

	show(): void {
		this.open = true;
	}
}

export const inboxDialog = new InboxDialog();
