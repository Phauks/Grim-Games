<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { canVibrate, vibrate } from './sound.ts';
</script>

<!-- Vibration or the sound, both or neither (Trevor, 2026-10-18). Shown off and disabled, with
     why, on devices that cannot vibrate, so it looks the same everywhere. One switch for the
     timer's sheets and Settings > Sound. -->
<SettingToggle
	label={t('day.timerVibrate')}
	description={canVibrate() ? undefined : t('day.timerVibrateUnavailable')}
	checked={canVibrate() && preferences.current.timerVibrate}
	disabled={!canVibrate()}
	onChange={(timerVibrate) => {
		preferences.update({ timerVibrate });
		if (timerVibrate) vibrate();
	}}
/>
