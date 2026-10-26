<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, TEXT_SCALE } from '#lib/ui/preferences.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	/**
	 * Text size and Pinch to zoom: Settings > Text, and the player screen's You sheet, so
	 * players reach them in one tap (Trevor, 2026-10-26, plan E2).
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
<SettingToggle
	label={t('settings.allowZoom')}
	description={t('settings.allowZoomHelp')}
	checked={preferences.current.allowZoom}
	onChange={(allowZoom) => preferences.update({ allowZoom })}
/>
