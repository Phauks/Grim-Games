<script lang="ts" generics="T extends string">
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import SettingRow from './SettingRow.svelte';

	interface Props {
		label: string;
		description?: string;
		value: T;
		options: { value: T; label: string }[];
		onChange: (value: T) => void;
		/** The default; gives the label a reset icon. */
		defaultValue?: T;
		disabled?: boolean;
	}

	let { label, description, defaultValue, ...segmented }: Props = $props();
</script>

<!-- A setting with a few short ordered options (sizes, levels). -->
<SettingRow
	{label}
	{description}
	onReset={defaultValue === undefined ? undefined : () => segmented.onChange(defaultValue)}
	isDefault={segmented.value === defaultValue}
>
	{#snippet control(labelId)}
		<Segmented {label} labelledBy={labelId} {...segmented} />
	{/snippet}
</SettingRow>
