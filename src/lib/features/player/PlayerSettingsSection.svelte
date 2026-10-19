<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { playerSettings, SHEET_DENSITIES } from './player-settings.svelte.ts';
	import PrintSettingsFields from './PrintSettingsFields.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
</script>

<SettingSelect
	label={t('player.density')}
	description={t('player.densityDetail')}
	value={playerSettings.current.density}
	options={SHEET_DENSITIES.map((value) => ({ value, label: t(`player.density.${value}`) }))}
	defaultValue="normal"
	onChange={(density) => playerSettings.update({ density })}
/>

<!-- Also in Print's own screen (Trevor: every setting in Settings and where it is used). -->
<Collapsible title={t('player.printSettings')} level={3} storageKey="settings-player-print">
	<PrintSettingsFields />
</Collapsible>
