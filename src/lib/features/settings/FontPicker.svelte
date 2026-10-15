<script lang="ts">
	import {
		FONT_ROLE_INFO,
		FONTS,
		fontsFor,
		fontStack,
		type FontId,
		type FontInfo,
		type FontRole
	} from '#lib/ui/fonts/catalogue.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';

	interface Props {
		role: FontRole;
		value: FontId;
		onChange: (font: FontId) => void;
	}

	let { role, value, onChange }: Props = $props();

	const info = $derived(FONT_ROLE_INFO[role]);
	const options = $derived(
		fontsFor(role).map((font) => ({ value: font.id, label: font.family, description: font.note }))
	);
	// Short roles set names and titles, so their fonts preview at the weight they will use.
	const weight = (font: FontInfo) => (info.length === 'short' ? font.displayWeight : 400);
</script>

<!-- One font role as a dropdown; every font name is drawn in its own font. -->
<SettingSelect
	label={info.label}
	description={info.description}
	{value}
	{options}
	{onChange}
>
	{#snippet item(option)}
		{@const font = FONTS[option.value]}
		<span class="name" style:font-family={fontStack(font.id)} style:font-weight={weight(font)}>
			{font.family}
		</span>
		{#if font.note}<small>{font.note}</small>{/if}
	{/snippet}
	{#snippet selected(option)}
		{@const font = FONTS[option.value]}
		<span class="name" style:font-family={fontStack(font.id)} style:font-weight={weight(font)}>
			{font.family}
		</span>
	{/snippet}
</SettingSelect>

<style>
	.name {
		font-size: 1.05rem;
		line-height: 1.3;
	}
</style>
