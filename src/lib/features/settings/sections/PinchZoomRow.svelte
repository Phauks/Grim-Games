<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
</script>

<!-- Pinch to zoom: a touch gesture, not text (Trevor, 2026-10-27: moved from Text). It zooms
     every screen, but the board is where two hands rest on the screen. Per device, never synced. -->
<SettingToggle
	label={t('settings.allowZoom')}
	description={t('settings.allowZoomHelp')}
	checked={preferences.current.allowZoom}
	onChange={(allowZoom) => preferences.update({ allowZoom })}
/>
