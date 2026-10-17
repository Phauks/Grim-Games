/** Whether the settings modal is open, and which section it shows (null: the section list). */
class SettingsDialog {
	open = $state(false);
	section = $state<string | null>(null);
	/**
	 * Opened from where a setting takes effect (e.g. the board's menu): only that section shows,
	 * with no way back into the full Settings list, and closing returns there (Trevor,
	 * 2026-10-17).
	 */
	only = $state(false);

	/** The global Settings: every section, optionally starting at one. */
	show(section: string | null = null): void {
		this.section = section;
		this.only = false;
		this.open = true;
	}

	/** One section on its own, for a place in the app that uses its settings. */
	showOnly(section: string): void {
		this.section = section;
		this.only = true;
		this.open = true;
	}
}

export const settingsDialog = new SettingsDialog();
