<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TEXT_SCALES, type TextScale } from '#lib/ui/preferences.ts';
	import SettingChoice from '#lib/ui/settings/SettingChoice.svelte';
	import SettingSegmented from '#lib/ui/settings/SettingSegmented.svelte';
	import { THEMES } from '#lib/ui/themes/registry.ts';

	const scaleLabels: Record<TextScale, string> = {
		0.875: 'S',
		1: 'M',
		1.125: 'L',
		1.25: 'XL',
		1.5: 'XXL'
	};
</script>

<SettingChoice
	label="Theme"
	value={preferences.theme.id}
	options={THEMES.map((theme) => ({ value: theme.id, label: theme.name }))}
	onChange={(themeId) => preferences.update({ themeId })}
/>
<SettingSegmented
	label="Text size"
	description="Scales all text and controls on this device."
	value={String(preferences.current.textScale)}
	options={TEXT_SCALES.map((scale) => ({ value: String(scale), label: scaleLabels[scale] }))}
	onChange={(scale) => preferences.update({ textScale: Number(scale) as TextScale })}
/>
