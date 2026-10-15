<script lang="ts">
	import { FONTS, fontsFor, fontStack, type FontId } from '#lib/ui/fonts/catalogue.ts';
	import SettingChoice from '#lib/ui/settings/SettingChoice.svelte';

	interface Props {
		role: 'display' | 'text';
		label: string;
		description?: string;
		value: FontId;
		sample: string;
		onChange: (font: FontId) => void;
	}

	let { role, label, description, value, sample, onChange }: Props = $props();

	const options = $derived(fontsFor(role).map((font) => ({ value: font.id, label: font.family })));
</script>

<!-- Each option previews the sample text in its own font. -->
<SettingChoice {label} {description} {value} {options} {onChange}>
	{#snippet item(option)}
		{@const font = FONTS[option.value]}
		<span
			class="sample"
			data-role={role}
			style:font-family={fontStack(font.id)}
			style:font-weight={role === 'display' ? font.displayWeight : undefined}
		>
			{sample}
		</span>
		<small>{font.family}{font.note ? ` · ${font.note}` : ''}</small>
	{/snippet}
</SettingChoice>

<style>
	.sample {
		display: block;
		font-size: 1.15rem;
		overflow-wrap: anywhere;
	}
	.sample[data-role='display'] {
		color: var(--heading);
	}
	small {
		display: block;
		margin-top: var(--space-1);
		font-family: var(--font-text);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
</style>
