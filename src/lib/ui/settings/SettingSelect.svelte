<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SettingRow from './SettingRow.svelte';

	interface Option {
		value: T;
		label: string;
		description?: string;
	}

	interface Props {
		label: string;
		description?: string;
		value: T;
		options: Option[];
		onChange: (value: T) => void;
		/** The default; gives the label a reset icon. */
		defaultValue?: T;
		item?: Snippet<[Option]>;
		selected?: Snippet<[Option]>;
		disabled?: boolean;
	}

	let { label, description, defaultValue, ...select }: Props = $props();
</script>

<!-- A setting picked from a dropdown: longer lists where only the choice needs to show. -->
<SettingRow
	{label}
	{description}
	onReset={defaultValue === undefined ? undefined : () => select.onChange(defaultValue)}
	isDefault={select.value === defaultValue}
>
	{#snippet control(labelId)}
		<Select {label} labelledBy={labelId} {...select} />
	{/snippet}
</SettingRow>
