<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import SettingRow from './SettingRow.svelte';

	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		label: string;
		description?: string;
		value: T;
		options: Option[];
		onChange: (value: T) => void;
		layout?: 'cards' | 'row';
		item?: Snippet<[Option]>;
	}

	let { label, description, ...choice }: Props = $props();
</script>

<!-- A setting picked from a visible set of options (themes, fonts, icon weights). -->
<SettingRow {label} {description}>
	{#snippet control(labelId)}
		<ChoiceGroup {label} labelledBy={labelId} {...choice} />
	{/snippet}
</SettingRow>
