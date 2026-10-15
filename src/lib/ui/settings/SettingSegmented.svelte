<script lang="ts" generics="T extends string">
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import SettingRow from './SettingRow.svelte';

	interface Props {
		label: string;
		description?: string;
		value: T;
		options: { value: T; label: string }[];
		onChange: (value: T) => void;
	}

	let { label, description, ...segmented }: Props = $props();
</script>

<!-- A setting with a few short ordered options (sizes, levels). -->
<SettingRow {label} {description}>
	{#snippet control(labelId)}
		<Segmented {label} labelledBy={labelId} {...segmented} />
	{/snippet}
</SettingRow>
