<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { STORYTELLER_GROUPS } from './storyteller-groups.ts';

	const assistance = $derived(preferences.current.assistance);
</script>

<!-- Every Storyteller-only setting, under plain headings so the list scans (Trevor, 2026-10-17). -->
{#snippet toggle(key: AssistKey)}
	<SettingToggle
		label={ASSIST_LABELS[key].label}
		description={ASSIST_LABELS[key].description}
		checked={assistance[key]}
		onChange={(checked) => preferences.update({ assistance: { ...assistance, [key]: checked } })}
	/>
{/snippet}

<h3>{t('settings.groupNight')}</h3>
{#each STORYTELLER_GROUPS.night as key (key)}{@render toggle(key)}{/each}

<h3>{t('settings.groupSetup')}</h3>
{#each STORYTELLER_GROUPS.setup as key (key)}{@render toggle(key)}{/each}
<!-- What face-down bag tiles show (Trevor, 2026-10-16: a dropdown, not a switch). -->
<SettingSelect
	label={t('settings.tileLabels')}
	value={preferences.current.tileFace}
	options={[
		{ value: 'numbers', label: t('settings.tileLabels.numbers') },
		{ value: 'letters', label: t('settings.tileLabels.letters') },
		{ value: 'symbols', label: t('settings.tileLabels.symbols') },
		{ value: 'colours', label: t('settings.tileLabels.colours') },
		{ value: 'emoji', label: t('settings.tileLabels.emoji') },
		{ value: 'random', label: t('settings.tileLabels.random') }
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

<h3>{t('settings.groupDay')}</h3>
{#each STORYTELLER_GROUPS.day as key (key)}{@render toggle(key)}{/each}

<style>
	h3 {
		margin: var(--space-5) 0 var(--space-1);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	h3:first-of-type {
		margin-top: 0;
	}
</style>
