import { registerSettingsSection } from '#lib/features/settings/registry.ts';
import PlayerSettingsSection from './PlayerSettingsSection.svelte';
import { playerSettings, PRINT_DEFAULTS } from './player-settings.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { DEFAULT_TOKEN_APPEARANCE } from '#lib/ui/token/token-appearance.ts';
import { PLAYER_SIZE_KEYS } from './player-size-rows.ts';
import { boardLooks, DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';

// The player view's own settings section (settings registry: features add their own).
registerSettingsSection({
	id: 'player-view',
	// "Player", like "Storyteller" (Trevor, 2026-10-18).
	label: 'Player',
	icon: 'notes',
	component: PlayerSettingsSection,
	reset: () => {
		playerSettings.update({
			density: 'normal',
			print: PRINT_DEFAULTS,
			frame: undefined,
			avatar: 'initials',
			hideGuesses: false,
			sheetBackground: 'theme'
		});
		// Its text and token sizes too, which Settings > Tokens shows as well (PlayerSizeRows).
		const tokenAppearance = { ...preferences.current.tokenAppearance };
		for (const key of PLAYER_SIZE_KEYS)
			Object.assign(tokenAppearance, { [key]: DEFAULT_TOKEN_APPEARANCE[key] });
		preferences.update({ tokenAppearance });
		boardLooks.update({ nameSize: DEFAULT_BOARD_LOOKS.nameSize });
	},
	order: 37
});
