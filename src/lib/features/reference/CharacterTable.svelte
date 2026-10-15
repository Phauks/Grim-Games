<script lang="ts">
	import { CHARACTER_TYPES } from '#lib/core/data/types.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import {
		activeFilterCount,
		ALIGNMENT_CHOICES,
		nextSort,
		tableRows,
		type Presence,
		type TableColumn
	} from '#lib/core/rules/reference-table.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
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
		entries: readonly ReferenceEntry[];
		onExplain: (title: string, text: string) => void;
		/** Shows one field's whole value in the shared details dialog. */
		onShowField: (entry: ReferenceEntry, field: FieldId) => void;
	}

	let { entries, onExplain, onShowField }: Props = $props();

	const table = $derived(referenceTable.current);
	const rows = $derived(tableRows(entries, table));
	const active = $derived(activeFilterCount(table.filters));
	let typesOpen = $state(false);

	function ariaSort(column: TableColumn | undefined) {
		if (!column || table.sort?.column !== column) return undefined;
		return table.sort.direction;
	}

	function presenceKey(field: ReferenceField) {
		return field.sort as Exclude<TableColumn, 'name' | 'type' | 'edition' | 'alignment'>;
	}

	function toggleType(type: (typeof CHARACTER_TYPES)[number], on: boolean) {
		const types = table.filters.types ?? [];
		referenceTable.setFilter(
			'types',
			on ? [...types.filter((t) => t !== type), type] : types.filter((t) => t !== type)
		);
	}
</script>

<!-- Reserved line: the count and Clear button are always there, so nothing below moves. -->
<div class="filter-bar">
	<span class="count" aria-live="polite" data-testid="table-count">
		{rows.length} of {entries.length} · {active === 0
			? 'no filters'
			: `${active} filter${active === 1 ? '' : 's'}`}
	</span>
	<Button
		variant="quiet"
		icon="close"
		disabled={active === 0}
		onclick={() => referenceTable.clearFilters()}>Clear filters</Button
	>
</div>

<!-- Scrolls sideways inside its own box on a phone; the page never does. -->
<div class="scroll" role="region" aria-label="Characters table">
	<table data-testid="character-table">
		<thead>
			<tr>
				{#each REFERENCE_FIELDS as field (field.id)}
					<th scope="col" data-col={field.id} aria-sort={ariaSort(field.sort)}>
						{#if field.sort}
							{@const sort = field.sort}
							<button
								type="button"
								class="sort"
								onclick={() => (referenceTable.sort = nextSort(table.sort, sort))}
							>
								{field.label}
								{#if table.sort?.column === sort}
									<Icon
										name={table.sort.direction === 'ascending' ? 'sortAscending' : 'sortDescending'}
									/>
								{:else}
									<span class="unsorted"><Icon name="sort" /></span>
								{/if}
							</button>
						{:else}
							<span class="plain">{field.label}</span>
						{/if}
					</th>
				{/each}
			</tr>
			<tr class="filters">
				{#each REFERENCE_FIELDS as field (field.id)}
					<td data-col={field.id}>
						{#if field.filter === 'text'}
							<input
								type="search"
								aria-label="Filter {field.label}"
								placeholder="Filter"
								value={table.filters.name ?? ''}
								oninput={(e) => referenceTable.setFilter('name', e.currentTarget.value)}
							/>
						{:else if field.filter === 'types'}
							<button
								type="button"
								class="pick"
								aria-haspopup="dialog"
								onclick={() => (typesOpen = true)}
							>
								<Icon name="filter" />
								{table.filters.types?.length
									? table.filters.types.map((t) => TYPE_PLURALS[t]).join(', ')
									: 'All'}
							</button>
						{:else if field.filter === 'alignment'}
							<select
								aria-label="Filter {field.label}"
								value={table.filters.alignment ?? ''}
								onchange={(e) =>
									referenceTable.setFilter('alignment', e.currentTarget.value || undefined)}
							>
								<option value="">All</option>
								{#each ALIGNMENT_CHOICES as choice (choice)}<option value={choice}>{choice}</option
									>{/each}
							</select>
						{:else if field.filter === 'presence'}
							{@const key = presenceKey(field)}
							{@const labels = PRESENCE_LABELS[field.id] ?? { yes: 'Has', no: 'None' }}
							<select
								aria-label="Filter {field.label}"
								value={table.filters[key] ?? ''}
								onchange={(e) =>
									referenceTable.setFilter(
										key,
										(e.currentTarget.value || undefined) as Presence | undefined
									)}
							>
								<option value="">All</option>
								<option value="yes">{labels.yes}</option>
								<option value="no">{labels.no}</option>
							</select>
						{/if}
					</td>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as entry (entry.character.id)}
				<tr data-character={entry.character.id} data-type={entry.character.type}>
					{#each REFERENCE_FIELDS as field (field.id)}
						{#if field.id === 'name'}
							<th scope="row" data-col="name"><FieldValue field="name" {entry} {onExplain} /></th>
						{:else}
							<td data-col={field.id}>
								{#if field.long}
									<!-- Clamped to a fixed height; the whole value opens in the details dialog. -->
									<div class="clamp"><FieldValue field={field.id} {entry} {onExplain} /></div>
									<button
										type="button"
										class="more"
										onclick={() => onShowField(entry, field.id)}
										aria-label="{field.label} for {entry.character.name}">More</button
									>
								{:else}
									<FieldValue field={field.id} {entry} {onExplain} tokenSize={40} />
								{/if}
							</td>
						{/if}
					{/each}
				</tr>
			{:else}
				<tr><td class="empty" colspan={REFERENCE_FIELDS.length}>No characters match.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<Dialog bind:open={typesOpen} title="Filter by type">
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
	{#snippet actions()}
		<Button variant="quiet" onclick={() => referenceTable.setFilter('types', undefined)}
			>All types</Button
		>
		<Button onclick={() => (typesOpen = false)}>Done</Button>
	{/snippet}
</Dialog>

<style>
	.filter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.count {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.scroll {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	table {
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	thead th {
		padding: 0;
		background: var(--surface-selected);
		vertical-align: bottom;
	}
	.sort,
	.plain {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		text-align: left;
		white-space: nowrap;
		--icon-size: calc(0.95 * var(--u));
	}
	.sort {
		cursor: pointer;
	}
	th[aria-sort] .sort {
		color: var(--heading);
	}
	.unsorted {
		display: inline-flex;
		opacity: 0.45;
	}
	.filters td {
		background: var(--surface-selected);
		padding-top: 0;
	}
	.filters input,
	.filters select,
	.pick {
		width: 100%;
		min-width: calc(6.5 * var(--u));
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--on-surface);
		font: inherit;
		/* 16px or more stops iOS zooming into the field. */
		font-size: max(0.9rem, 16px);
	}
	.pick {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		max-width: calc(10 * var(--u));
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85rem;
		cursor: pointer;
		--icon-size: calc(1 * var(--u));
	}
	tbody th {
		font-weight: 600;
		white-space: nowrap;
	}
	td[data-col='token'] {
		width: calc(3.5 * var(--u));
	}
	td[data-col='ability'] {
		min-width: calc(16 * var(--u));
	}
	td[data-col='firstNight'],
	td[data-col='otherNight'],
	td[data-col='preDay'],
	td[data-col='jinxes'] {
		min-width: calc(15 * var(--u));
	}
	td[data-col='tokens'],
	td[data-col='problems'] {
		min-width: calc(10 * var(--u));
	}
	td[data-col='setup'],
	td[data-col='special'] {
		min-width: calc(9 * var(--u));
	}
	td[data-col='links'] {
		min-width: calc(9 * var(--u));
	}
	.clamp {
		max-height: calc(5.4 * var(--u));
		overflow: hidden;
		mask-image: linear-gradient(to bottom, black 70%, transparent);
	}
	.more {
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--heading);
		font: inherit;
		font-size: 0.85rem;
		text-decoration: underline;
		cursor: pointer;
	}
	.empty {
		padding: var(--space-4);
		color: var(--on-surface-muted);
	}
	fieldset {
		display: grid;
		margin: 0;
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
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
