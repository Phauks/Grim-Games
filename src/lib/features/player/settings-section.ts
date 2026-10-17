import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import PlayerSettingsSection from './PlayerSettingsSection.svelte';

// The player view's own settings section (settings registry: features add their own).
registerSettingsSection({
	id: 'player-view',
	label: 'Player view',
	icon: 'notes',
	component: PlayerSettingsSection,
	order: 37
});
