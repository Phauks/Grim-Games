import {
	registerSettingsHeaderButton,
	registerSettingsSection
} from '#lib/features/settings/registry.ts';
import PlayerSettingsSection from './PlayerSettingsSection.svelte';
import PrintSettingsFields from './PrintSettingsFields.svelte';
import ProfileButton from './ProfileButton.svelte';
import { playerSettings, PRINT_DEFAULTS } from './player-settings.svelte.ts';
import { DEFAULT_REMINDER_LINES } from '#lib/features/board/reminder-lines.ts';

// The player view's own settings section (settings registry: features add their own).
registerSettingsSection({
	id: 'player-view',
	// "Player", like "Storyteller" (Trevor, 2026-10-18).
	label: 'Player',
	icon: 'notes',
	component: PlayerSettingsSection,
	reset: () => {
		playerSettings.update({
			hideGuesses: false,
			matchShape: false,
			townMatchShape: true,
			sheetBackground: 'theme',
			reminderLines: DEFAULT_REMINDER_LINES,
			showJinxesOnly: false
		});
	},
	order: 37
});

// The player's Profile opens from the button beside Settings' X (Trevor, 2026-10-27), in its
// own dialog (2026-11-15).
registerSettingsHeaderButton(ProfileButton);

// Print gets its own section (Trevor, 2026-10-27); the same fields sit in Print's own screen.
// Sheet background stays in Player: it also colours the on-screen sheet.
registerSettingsSection({
	id: 'print',
	label: { key: 'settings.sectionPrint' },
	icon: 'print',
	component: PrintSettingsFields,
	reset: () => playerSettings.update({ print: PRINT_DEFAULTS }),
	order: 38
});
