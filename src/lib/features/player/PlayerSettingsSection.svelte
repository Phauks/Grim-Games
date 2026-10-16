<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSegmented from '#lib/ui/settings/SettingSegmented.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playerSettings, SHEET_DENSITIES } from './player-settings.svelte.ts';
</script>

<SettingSegmented
	label={t('player.density')}
	description={t('player.densityDetail')}
	value={playerSettings.current.density}
	options={SHEET_DENSITIES.map((value) => ({ value, label: t(`player.density.${value}`) }))}
	defaultValue="normal"
	onChange={(density) => playerSettings.update({ density })}
/>

<SettingToggle
	label={t('player.hideNoteContents')}
	description={t('player.hideNoteContentsDetail')}
	checked={playerSettings.current.hideNoteContents}
	onChange={(hideNoteContents) => playerSettings.update({ hideNoteContents })}
/>
