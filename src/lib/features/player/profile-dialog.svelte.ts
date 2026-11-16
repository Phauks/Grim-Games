/**
 * Whether the player's Profile dialog is open (Trevor, 2026-11-15, option E): its own dialog,
 * opened from Home's player card, the menu's Profile button and the button beside Settings' X.
 */
class ProfileDialogState {
	open = $state(false);

	show(): void {
		this.open = true;
	}
}

export const profileDialog = new ProfileDialogState();
