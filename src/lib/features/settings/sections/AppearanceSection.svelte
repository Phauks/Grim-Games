<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { ICON_SCALES, TEXT_SCALES, type IconScale, type TextScale } from '#lib/ui/preferences.ts';
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
	const iconScaleLabels: Record<IconScale, string> = { 0.875: 'S', 1: 'M', 1.25: 'L', 1.5: 'XL' };
</script>

<SettingChoice
	label="Theme"
	value={preferences.theme.id}
	options={THEMES.map((theme) => ({ value: theme.id, label: theme.name }))}
	onChange={(themeId) => preferences.update({ themeId })}
/>
<SettingSegmented
	label="Text size"
	description="Changes the size of text only; buttons, icons and spacing stay the same."
	value={String(preferences.current.textScale)}
	options={TEXT_SCALES.map((scale) => ({ value: String(scale), label: scaleLabels[scale] }))}
	onChange={(scale) => preferences.update({ textScale: Number(scale) as TextScale })}
/>
<SettingSegmented
	label="Icon size"
	description="Changes the size of interface icons: header, settings, menus, buttons, status markers such as dead or poisoned, and character icons in badges. Text size and character token size stay the same."
	value={String(preferences.current.iconScale)}
	options={ICON_SCALES.map((scale) => ({ value: String(scale), label: iconScaleLabels[scale] }))}
	onChange={(scale) => preferences.update({ iconScale: Number(scale) as IconScale })}
/>
