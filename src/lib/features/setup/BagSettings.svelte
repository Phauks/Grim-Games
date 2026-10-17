<script lang="ts">
	import { STORYTELLER_GROUPS } from '#lib/features/settings/sections/storyteller-groups.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	let open = $state(false);
	const assistance = $derived(preferences.current.assistance);
</script>

<!--
	The setup and bag draw settings, reachable while dealing with the bag (Trevor, 2026-10-17).
	The same stored values as Settings > Storyteller, so a change in one shows in the other.
-->
<IconButton icon="settings" label={t('settings.groupSetup')} onclick={() => (open = true)} />
<Dialog bind:open title={t('settings.groupSetup')}>
	<div class="settings" data-testid="bag-settings">
		{#each STORYTELLER_GROUPS.setup as key (key)}
			<SettingToggle
				label={ASSIST_LABELS[key].label}
				description={ASSIST_LABELS[key].description}
				checked={assistance[key]}
				onChange={(checked) =>
					preferences.update({ assistance: { ...assistance, [key]: checked } })}
			/>
		{/each}
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
	</div>
</Dialog>

<style>
	.settings {
		display: grid;
		gap: var(--space-2);
	}
</style>
