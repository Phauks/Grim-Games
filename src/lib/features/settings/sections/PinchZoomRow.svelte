<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
</script>

<!-- Pinch to zoom: it zooms every screen (back in Text once the board's settings moved into the
     game pane, Trevor 2026-11-18). Per device, never synced. -->
<SettingToggle
	label={t('settings.allowZoom')}
	description={t('settings.allowZoomHelp')}
	checked={preferences.current.allowZoom}
	onChange={(allowZoom) => preferences.update({ allowZoom })}
/>
