<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, STORYTELLER_HELP_KEYS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
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
<!-- A switch like the rest of this section (no radio groups here). -->
<SettingToggle
	label={t('settings.tileSymbols')}
	description={t('settings.tileSymbolsHelp')}
	checked={preferences.current.tileFace === 'symbols'}
	onChange={(checked) => preferences.update({ tileFace: checked ? 'symbols' : 'numbers' })}
/>
<SettingToggle
	label={t('settings.requireName')}
	description={t('settings.requireNameHelp')}
	checked={preferences.current.requireName}
	onChange={(requireName) => preferences.update({ requireName })}
/>
