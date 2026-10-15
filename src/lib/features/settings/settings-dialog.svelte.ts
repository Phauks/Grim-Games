/** Whether the settings modal is open, and which section it shows (null: the section list). */
class SettingsDialog {
	open = $state(false);
	section = $state<string | null>(null);

	show(section: string | null = null): void {
		this.section = section;
		this.open = true;
	}
}

export const settingsDialog = new SettingsDialog();
