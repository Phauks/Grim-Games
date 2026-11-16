<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
</script>

<!-- Whether the day timer makes its sound when time is up (Trevor, 2026-11-15: "don't always
     make noise"). One switch for the timer's sheets and Settings > Sound; off disables the
     Timer sound beside it rather than hiding it. -->
<SettingToggle
	label={t('day.timerSoundOn')}
	checked={preferences.current.timerSoundOn}
	onChange={(timerSoundOn) => preferences.update({ timerSoundOn })}
/>
