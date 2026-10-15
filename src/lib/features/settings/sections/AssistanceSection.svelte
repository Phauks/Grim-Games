<script lang="ts">
	import {
		ASSIST_KEYS,
		ASSIST_LABELS,
		ASSIST_PRESET_LABELS,
		ASSIST_PRESETS,
		assistPreset,
		type AssistPreset
	} from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingSegmented from '#lib/ui/settings/SettingSegmented.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	const assistance = $derived(preferences.current.assistance);
	const preset = $derived(assistPreset(assistance));
	// "Custom" is always listed (never added later) so the control never changes width.
	const options = (['guided', 'standard', 'expert', 'custom'] as const).map((value) => ({
		value,
		label: ASSIST_PRESET_LABELS[value]
	}));

	function choosePreset(value: AssistPreset | 'custom') {
		if (value === 'custom') return;
		preferences.update({ assistance: { ...ASSIST_PRESETS[value] } });
	}
</script>

<SettingSegmented
	label="How much help"
	description="Guided walks you through everything. Expert keeps only rules warnings. Change any switch below to make your own mix."
	value={preset}
	{options}
	onChange={choosePreset}
/>

<div class="switches">
	{#each ASSIST_KEYS as key (key)}
		<SettingToggle
			label={ASSIST_LABELS[key].label}
			description={ASSIST_LABELS[key].description}
			checked={assistance[key]}
			onChange={(checked) => preferences.update({ assistance: { ...assistance, [key]: checked } })}
		/>
	{/each}
</div>

<style>
	.switches {
		margin-top: var(--space-6, var(--space-5));
	}
</style>
