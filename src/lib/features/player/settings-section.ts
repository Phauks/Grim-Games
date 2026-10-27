import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import PlayerSettingsSection from './PlayerSettingsSection.svelte';
import ProfileButton from './ProfileButton.svelte';
import ProfileSection from './ProfileSection.svelte';
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
			print: PRINT_DEFAULTS,
			hideGuesses: false,
			matchShape: false,
			townMatchShape: true,
			sheetBackground: 'theme'
		});
	},
	order: 37
});

// The player's Profile: name, picture and laurel, opened from the button beside Settings' X
// rather than the section list (Trevor, 2026-10-27).
registerSettingsSection({
	id: 'profile',
	label: { key: 'player.profile' },
	icon: 'account',
	component: ProfileSection,
	listed: false,
	headerButton: ProfileButton,
	reset: () => playerSettings.update({ frame: undefined, avatar: 'initials' }),
	order: 1
});
