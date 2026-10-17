<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { playerSettings, SHEET_DENSITIES } from './player-settings.svelte.ts';
</script>

<SettingSelect
	label={t('player.density')}
	description={t('player.densityDetail')}
	value={playerSettings.current.density}
	options={SHEET_DENSITIES.map((value) => ({ value, label: t(`player.density.${value}`) }))}
	defaultValue="normal"
	onChange={(density) => playerSettings.update({ density })}
/>
