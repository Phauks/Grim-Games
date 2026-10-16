<script lang="ts">
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	const assistance = $derived(preferences.current.assistance);
</script>

<!-- Glossary linking for everyone, players included, so it is not under Storyteller settings. -->
<SettingToggle
	label={ASSIST_LABELS.explainTerms.label}
	description={ASSIST_LABELS.explainTerms.description}
	checked={assistance.explainTerms}
	onChange={(checked) =>
		preferences.update({ assistance: { ...assistance, explainTerms: checked } })}
/>
