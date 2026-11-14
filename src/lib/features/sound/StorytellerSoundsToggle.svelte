<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { storytellerSounds } from './storyteller-sounds.svelte.ts';
</script>

<!-- A player's answer to the join question, changed here (Trevor, 2026-11-14); off until
     they answer. -->
<SettingToggle
	label={t('settings.storytellerSounds')}
	checked={storytellerSounds.on}
	onChange={(on) => storytellerSounds.set(on ? 'on' : 'off')}
/>
