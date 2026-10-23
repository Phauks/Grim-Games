import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import PlayerSettingsSection from './PlayerSettingsSection.svelte';
import { playerSettings, PRINT_DEFAULTS } from './player-settings.svelte.ts';

// The player view's own settings section (settings registry: features add their own).
registerSettingsSection({
	id: 'player-view',
	// "Player", like "Storyteller" (Trevor, 2026-10-18).
	label: 'Player',
	icon: 'notes',
	component: PlayerSettingsSection,
	reset: () =>
		playerSettings.update({
			density: 'normal',
			print: PRINT_DEFAULTS,
			frame: undefined,
			avatar: undefined,
			guessesOnTokens: false
		}),
	order: 37
});
