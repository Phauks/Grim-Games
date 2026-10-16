<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
</script>

<SettingToggle
	label={t('player.hideNoteContents')}
	description={t('player.hideNoteContentsDetail')}
	checked={playerSettings.current.hideNoteContents}
	onChange={(hideNoteContents) => playerSettings.update({ hideNoteContents })}
/>
