<script lang="ts">
	import { CHARACTER_TYPES, type Character } from '#lib/core/data/types.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import {
		ALIGNMENT_CHOICES,
		nextSort,
		type Presence,
		type TableColumn
	} from '#lib/core/rules/reference-table.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
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
	}

	let { rows, onExplain }: Props = $props();

	const table = $derived(referenceTable.current);

	/** Fixed widths (in --u): layout never depends on which rows are drawn, so nothing reflows. */
	const WIDTHS: Record<FieldId, number> = {
		token: 4,
		// Plain text: wide enough for the longest names (Deus ex Fiasco, Hell's Librarian).
		name: 10,
		type: 7,
		edition: 9,
		icons: 6.5,
		alignment: 11,
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
		TABLE_FIELDS.map((field): DataColumn<FieldId> => ({
			id: field.id,
			label: field.label,
			width: `calc(${WIDTHS[field.id]} * var(--u))`,
			sortable: field.sort !== undefined,
			filterable: field.filter !== undefined,
			filtered: filterSet(field),
			rowHeader: field.id === 'name',
			stackHead: field.id === 'token'
		}))
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

	const field = (id: FieldId) => REFERENCE_FIELDS.find((f) => f.id === id)!;
</script>

{#snippet choices(
	name: string,
	options: readonly { value: string; label: string }[],
	value: string,
	onPick: (value: string) => void
)}
	<fieldset>
		<legend class="visually-hidden">{name}</legend>
		{#each options as option (option.value)}
			<label class="check">
				<input
					type="radio"
					{name}
					value={option.value}
					checked={value === option.value}
					onchange={() => onPick(option.value)}
				/>
				{option.label}
			</label>
		{/each}
	</fieldset>
{/snippet}

{#snippet filter(column: DataColumn<FieldId>, close: () => void)}
	{@const f = field(column.id)}
	{#if f.filter === 'text'}
		<input
			class="text"
			type="search"
			aria-label="Filter {f.label}"
			placeholder="Filter"
			enterkeyhint="done"
			value={table.filters.name ?? ''}
			oninput={(e) => referenceTable.setFilter('name', e.currentTarget.value)}
			onkeydown={(e) => e.key === 'Enter' && close()}
		/>
	{:else if f.filter === 'types'}
		<fieldset>
			<legend class="visually-hidden">Character types</legend>
			{#each CHARACTER_TYPES as type (type)}
				<label class="check">
					<input
						type="checkbox"
						checked={table.filters.types?.includes(type) ?? false}
						onchange={(e) => toggleType(type, e.currentTarget.checked)}
					/>
					{TYPE_PLURALS[type]}
				</label>
			{/each}
		</fieldset>
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
				{ value: 'no', label: labels.no }
			],
			table.filters[key] ?? '',
			(v) => referenceTable.setFilter(key, (v || undefined) as Presence | undefined)
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
	fieldset {
		display: grid;
		margin: var(--space-2) 0 0;
		padding: 0;
		border: 0;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
	}
	.check input {
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
	}
	.text {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		margin-top: var(--space-2);
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--on-surface);
		font: inherit;
		/* 16px or more stops iOS zooming into the field. */
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	/* Stacked rows: the value sits beside its label when there is room, else under it. */
	@container data-table (max-width: 40rem) {
		.cell {
			flex: 1 1 calc(8 * var(--u));
		}
	}
</style>
