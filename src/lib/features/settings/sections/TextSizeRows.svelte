<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, TEXT_SCALE } from '#lib/ui/preferences.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';

	/**
	 * Text size: Settings > Text, and the player screen's You sheet, so players reach it in
	 * one tap (Trevor, 2026-10-26, plan E2). Pinch to zoom is in Board (Trevor, 2026-10-27).
	 */
</script>

<SettingSlider
	label={t('settings.textSize')}
	description={t('settings.textSizeHelp')}
	value={preferences.current.textScale}
	defaultValue={DEFAULT_PREFERENCES.textScale}
	{...TEXT_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(textScale) => preferences.update({ textScale })}
/>
