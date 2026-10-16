<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, STORYTELLER_HELP_KEYS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	const assistance = $derived(preferences.current.assistance);
</script>

{#each STORYTELLER_HELP_KEYS as key (key)}
	<SettingToggle
		label={ASSIST_LABELS[key].label}
		description={ASSIST_LABELS[key].description}
		checked={assistance[key]}
		onChange={(checked) => preferences.update({ assistance: { ...assistance, [key]: checked } })}
	/>
{/each}
<!-- What face-down bag tiles show (Trevor, 2026-10-16: a dropdown, not a switch). -->
<SettingSelect
	label={t('settings.tileLabels')}
	value={preferences.current.tileFace}
	options={[
		{ value: 'numbers', label: t('settings.tileLabels.numbers') },
		{ value: 'letters', label: t('settings.tileLabels.letters') }
	]}
	defaultValue="numbers"
	onChange={(tileFace) => preferences.update({ tileFace })}
/>
<SettingToggle
	label={t('settings.requireName')}
	description={t('settings.requireNameHelp')}
	checked={preferences.current.requireName}
	onChange={(requireName) => preferences.update({ requireName })}
/>
