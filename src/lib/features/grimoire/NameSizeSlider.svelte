<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import { boardLooks, DEFAULT_BOARD_LOOKS, NAME_SIZE } from './board-looks.svelte.ts';

	/**
	 * The player name badge's size under each seat's token: Settings > Tokens and the player's
	 * own settings, for the board and the player's Grim tab alike (Trevor, 2026-10-27).
	 */
</script>

<SettingSlider
	label={t('settings.nameSize')}
	value={boardLooks.current.nameSize}
	{...NAME_SIZE}
	defaultValue={DEFAULT_BOARD_LOOKS.nameSize}
	format={(size) => intl.number(size, { style: 'percent' })}
	onChange={(nameSize) => boardLooks.update({ nameSize })}
/>
