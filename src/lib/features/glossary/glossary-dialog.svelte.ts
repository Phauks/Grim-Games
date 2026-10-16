/**
 * The full Glossary dialog (GlossaryDialog, mounted with the popover in the root layout), so
 * any screen, the board included, can browse every entry without leaving it.
 */
class GlossaryDialogState {
	open = $state(false);
	/** The shown entry, by `glossaryKey`. */
	key = $state<string>();

	show(key: string | undefined): void {
		this.key = key;
		this.open = true;
	}
}

export const glossaryDialog = new GlossaryDialogState();
