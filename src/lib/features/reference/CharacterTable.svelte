<script lang="ts">
	import { CHARACTER_TYPES, type Character } from '#lib/core/data/types.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import {
		ALIGNMENT_CHOICES,
		nextSort,
		type TokensFilter,
		type TableColumn
	} from '#lib/core/rules/reference-table.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import FilterOptions from '#lib/ui/table/FilterOptions.svelte';
	import type { ColumnFilter } from '#lib/ui/table/column-filter.ts';
	import { fieldFilterValue } from './field-filter.ts';
	import FieldValue from './FieldValue.svelte';
	import {
		PRESENCE_LABELS,
		REFERENCE_FIELDS,
		type FieldId,
		type ReferenceField
	} from './fields.ts';
	import { TYPE_PLURALS } from './labels.ts';
	import { referenceTable } from './table-state.svelte.ts';

	interface Props {
		/** Already filtered and sorted (`tableRows`), so the page can show the count. */
		rows: readonly ReferenceEntry[];
		onExplain: (title: string, text: string, character?: Character) => void;
		/** The shared table's own filters, for columns without a Reference one. */
		columnFilters?: Partial<Record<FieldId, ColumnFilter>>;
		/** Told how many rows are left after those filters. */
		oncount?: (count: number) => void;
	}

	let { rows, onExplain, columnFilters = $bindable({}), oncount }: Props = $props();

	const table = $derived(referenceTable.current);

	/** Fixed widths (in --u): layout never depends on which rows are drawn, so nothing reflows. */
	const WIDTHS: Record<FieldId, number> = {
		token: 4,
		// Plain text: wide enough for the longest names (Deus ex Fiasco, Hell's Librarian), and
		// its header for the label, sort, filter and Columns buttons.
		name: 13,
		type: 7,
		edition: 9,
		icons: 6.5,
		// "Starting alignment", its sort arrows and filter on one line (Trevor, 2026-10-18).
		alignment: 14.5,
		setup: 11,
		prep: 18,
		ability: 18,
		tokens: 12,
		special: 11,
		cards: 9,
		firstNight: 17,
		otherNight: 17,
		jinxes: 18,
		preDay: 19,
		problems: 15,
		links: 0
	};

	type PresenceColumn = Exclude<TableColumn, 'name' | 'type' | 'edition' | 'alignment'>;

	function filterSet(field: ReferenceField): boolean {
		const f = table.filters;
		switch (field.filter) {
			case 'text':
				return !!f.name?.trim();
			case 'types':
				return !!f.types?.length;
			case 'alignment':
				return !!f.alignment;
			case 'presence':
				return !!f[field.sort as PresenceColumn];
			default:
				return false;
		}
	}

	const TABLE_FIELDS = REFERENCE_FIELDS.filter((f) => !f.cardOnly);
	const columns = $derived(
		TABLE_FIELDS.map((field): DataColumn<FieldId, ReferenceEntry> => {
			const base = {
				id: field.id,
				label: field.label,
				width: `calc(${WIDTHS[field.id]} * var(--u))`,
				sortable: field.sort !== undefined,
				rowHeader: field.id === 'name',
				stackHead: field.id === 'token'
			};
			// Columns with no filter of their own get the shared table's (Trevor, 2026-10-18).
			if (field.filter) return { ...base, filterable: true, filtered: filterSet(field) };
			if (field.id === 'token') return { ...base, noFilter: 'The icon; Name filters by the same.' };
			return { ...base, value: (entry) => fieldFilterValue(entry, field.id) };
		})
	);

	const sort = $derived(
		table.sort && { column: fieldOf(table.sort.column), direction: table.sort.direction }
	);

	function fieldOf(column: TableColumn): FieldId {
		return REFERENCE_FIELDS.find((f) => f.sort === column)!.id;
	}

	function onSort(id: FieldId) {
		const column = REFERENCE_FIELDS.find((f) => f.id === id)?.sort;
		if (column) referenceTable.sort = nextSort(table.sort, column);
	}

	function toggleType(type: (typeof CHARACTER_TYPES)[number], on: boolean) {
		const types = table.filters.types ?? [];
		referenceTable.setFilter(
			'types',
			on ? [...types.filter((t) => t !== type), type] : types.filter((t) => t !== type)
		);
	}

	const TYPE_OPTIONS = CHARACTER_TYPES.map((type) => ({ value: type, label: TYPE_PLURALS[type] }));
	const field = (id: FieldId) => REFERENCE_FIELDS.find((f) => f.id === id)!;
</script>

{#snippet choices(
	name: string,
	options: readonly { value: string; label: string }[],
	value: string,
	onPick: (value: string) => void
)}
	<FilterOptions legend={name} hideLegend {name} {options} {value} onpick={onPick} />
{/snippet}

{#snippet filter(column: DataColumn<FieldId>, close: () => void)}
	{@const f = field(column.id)}
	{#if f.filter === 'text'}
		<div class="text">
			<SearchField
				label={t('reference.columnFilter', { column: f.label })}
				placeholder={t('reference.filterPlaceholder')}
				value={table.filters.name ?? ''}
				oninput={(v) => referenceTable.setFilter('name', v)}
				oncommit={() => (close(), false)}
			/>
		</div>
	{:else if f.filter === 'types'}
		<FilterOptions
			legend="Character types"
			hideLegend
			options={TYPE_OPTIONS}
			values={table.filters.types ?? []}
			ontoggle={(type, on) => toggleType(type as Character['type'], on)}
		/>
		<div class="actions">
			<Button variant="quiet" onclick={() => referenceTable.setFilter('types', undefined)}
				>All types</Button
			>
		</div>
	{:else if f.filter === 'alignment'}
		{@render choices(
			`filter-${f.id}`,
			[{ value: '', label: 'All' }, ...ALIGNMENT_CHOICES.map((c) => ({ value: c, label: c }))],
			table.filters.alignment ?? '',
			(v) => referenceTable.setFilter('alignment', v || undefined)
		)}
	{:else if f.filter === 'presence'}
		{@const key = f.sort as PresenceColumn}
		{@const labels = PRESENCE_LABELS[f.id] ?? { yes: 'Has', no: 'None' }}
		{@render choices(
			`filter-${f.id}`,
			[
				{ value: '', label: 'All' },
				{ value: 'yes', label: labels.yes },
				{ value: 'no', label: labels.no },
				// Tokens also split by setup (Trevor, 2026-10-17: "for diagnostic purposes").
				...(key === 'tokens'
					? [
							{ value: 'setup', label: t('reference.presence.setupTokens') },
							{ value: 'not-setup', label: t('reference.presence.noSetupTokens') }
						]
					: [])
			],
			table.filters[key] ?? '',
			(v) => referenceTable.setFilter(key, (v || undefined) as TokensFilter | undefined)
		)}
	{/if}
{/snippet}

{#snippet cell(entry: ReferenceEntry, column: DataColumn<FieldId>)}
	{@const f = field(column.id)}
	<!-- Shown in full: rows are as tall as their longest field (Trevor, 2026-10-16). -->
	<div class="cell">
		<FieldValue field={f.id} {entry} {onExplain} tokenSize={f.long ? undefined : 40} plainName />
	</div>
{/snippet}

<!--
	Wide screens get a real table. Narrow ones (phones, or large text) stack each row into a
	block of labelled fields, so the page never scrolls sideways (Trevor, 2026-10-16).
-->
<div class="table-view">
	<DataTable
		label="Characters"
		testid="character-table"
		{columns}
		{rows}
		key={(entry) => entry.character.id}
		rowLabel={(entry) => entry.character.name}
		{cell}
		{sort}
		{onSort}
		{filter}
		narrow="stack"
		fit="content"
		resizeKey="reference"
		bind:columnFilters
		{oncount}
		lazy
		rowEstimate="calc(10 * var(--u))"
		rowAttrs={(entry) => ({
			'data-character': entry.character.id,
			'data-type': entry.character.type
		})}
		empty="No characters match."
	/>
</div>

<style>
	.table-view {
		font-size: 0.9rem;
	}
	.text {
		margin-top: var(--space-2);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	/* Stacked rows: the value sits beside its label when there is room, else under it. */
	@container data-table (max-width: 40rem) {
		.cell {
			flex: 1 1 calc(8 * var(--u));
		}
	}
</style>
