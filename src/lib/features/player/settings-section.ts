import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import PlayerSettingsSection from './PlayerSettingsSection.svelte';
import PrintSettingsFields from './PrintSettingsFields.svelte';
import { playerSettings, PRINT_DEFAULTS } from './player-settings.svelte.ts';

// The player view's own settings section (settings registry: features add their own).
registerSettingsSection({
	id: 'player-view',
	// "Player", like "Storyteller" (Trevor, 2026-10-18).
	label: 'Player',
	icon: 'notes',
	component: PlayerSettingsSection,
	reset: () => {
		playerSettings.update({
			frame: undefined,
			avatar: 'initials',
			hideGuesses: false,
			matchShape: false,
			townMatchShape: true,
			sheetBackground: 'theme'
		});
	},
	order: 37
});

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
