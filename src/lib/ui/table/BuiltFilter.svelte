<!--
	The filter DataTable builds from a column's values (column-filter.ts): ticks for a few
	values, a search for text, lowest and highest for numbers.
-->
<script lang="ts">
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import {
		EMPTY,
		filterKindOf,
		pickOptions,
		readBound,
		type ColumnFilter,
		type FilterKind,
		type FilterValue
	} from '#lib/ui/table/column-filter.ts';
	import FilterOptions from '#lib/ui/table/FilterOptions.svelte';

	interface Props {
		/** The column's name. */
		label: string;
		/** The column's value in every row, before filtering. */
		values: readonly FilterValue[];
		current: ColumnFilter | undefined;
		/** The column's own choice of filter, else the one its values suggest. */
		kind?: FilterKind;
		/** The label for an empty value. */
		empty: string;
		onchange: (filter: ColumnFilter) => void;
		close: () => void;
	}

	let { label, values, current, kind: own, empty, onchange, close }: Props = $props();

	const kind = $derived(current?.kind ?? own ?? filterKindOf(values));
</script>

{#if kind === 'pick'}
	{@const ticked = current?.kind === 'pick' ? current.values : []}
	<FilterOptions
		legend={label}
		hideLegend
		options={pickOptions(values, ticked).map((v) => ({
			value: v,
			label: v === EMPTY ? empty : v
		}))}
		values={ticked}
		ontoggle={(v, on) =>
			onchange({
				kind: 'pick',
				values: on ? [...ticked, v] : ticked.filter((x) => x !== v)
			})}
		{empty}
	/>
{:else if kind === 'text'}
	<SearchField
		label="Search {label}"
		value={current?.kind === 'text' ? current.text : ''}
		oninput={(text) => onchange({ kind: 'text', text })}
		oncommit={close}
	/>
{:else}
	{@const range: Extract<ColumnFilter, { kind: 'range' }> =
		current?.kind === 'range' ? current : { kind: 'range' }}
	<div class="range">
		<TextField
			label="Lowest"
			inputmode="decimal"
			value={range.min === undefined ? '' : String(range.min)}
			oninput={(text) => onchange({ ...range, min: readBound(text) })}
			oncommit={close}
		/>
		<TextField
			label="Highest"
			inputmode="decimal"
			value={range.max === undefined ? '' : String(range.max)}
			oninput={(text) => onchange({ ...range, max: readBound(text) })}
			oncommit={close}
		/>
	</div>
{/if}

<style>
	.range {
		display: grid;
		gap: var(--space-2);
	}
</style>
