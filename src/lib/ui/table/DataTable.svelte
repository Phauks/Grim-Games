<script lang="ts" module>
	export type SortDirection = 'ascending' | 'descending';

	export interface DataColumn<K extends string = string> {
		id: K;
		label: string;
		/** A CSS grid track. Fixed widths keep columns the same whichever rows are drawn. */
		width?: string;
		sortable?: boolean;
		/** Has a filter: a funnel button in its header cell opens the `filter` snippet. */
		filterable?: boolean;
		/** Its filter is set (the funnel is highlighted). */
		filtered?: boolean;
		/** The rows' first cell: a row header (`th scope="row"`), always built. */
		rowHeader?: boolean;
		align?: 'start' | 'end';
		/** The header shows no visible label (it stays the accessible name). */
		hideLabel?: boolean;
		/** `narrow="hide"`: dropped on a narrow table; its filter moves to the first header. */
		wide?: boolean;
		/** The cell has no padding: its content (a full-size button) fills it. */
		flush?: boolean;
		/** `narrow="stack"`: stays on the row's first line, beside the row header, unlabelled. */
		stackHead?: boolean;
	}

	export interface DataSort<K extends string = string> {
		column: K;
		direction: SortDirection;
	}
</script>

<script lang="ts" generics="T, K extends string">
	import type { Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { near } from '#lib/ui/near.ts';
	import Popover from '#lib/ui/primitives/Popover.svelte';

	interface Props {
		/** The table's accessible name. */
		label: string;
		columns: readonly DataColumn<K>[];
		/** Already filtered and sorted (the pure functions live with each feature's data). */
		rows: readonly T[];
		key: (row: T) => string;
		cell: Snippet<[T, DataColumn<K>]>;
		sort?: DataSort<K>;
		onSort?: (column: K) => void;
		/** The filter controls for one column, in a popover from its header; `close` shuts it. */
		filter?: Snippet<[DataColumn<K>, () => void]>;
		/**
		 * Narrow tables (under 40rem): `stack` turns each row into a block of labelled fields;
		 * `hide` drops the `wide` columns.
		 */
		narrow?: 'stack' | 'hide';
		/** `content`: as wide as its columns, scrolling sideways in its box; `container`: fits. */
		fit?: 'content' | 'container';
		/** Fills its parent's height and scrolls rows under a sticky header. */
		fill?: boolean;
		/** Builds a row's cells when it first comes near the screen (near.ts); they then stay. */
		lazy?: boolean;
		/** A row's height before it is drawn: rows off screen skip layout and paint. */
		rowEstimate?: string;
		rowAttrs?: (row: T) => Record<string, string | undefined>;
		/** Marks a row as the chosen one (e.g. the current script). */
		rowSelected?: (row: T) => boolean;
		empty?: string;
		testid?: string;
	}

	let {
		label,
		columns,
		rows,
		key,
		cell,
		sort,
		onSort,
		filter,
		narrow = 'hide',
		fit = 'container',
		fill = false,
		lazy = false,
		rowEstimate = '3rem',
		rowAttrs,
		rowSelected,
		empty = 'None',
		testid
	}: Props = $props();

	const track = (column: DataColumn<K>) => column.width ?? 'minmax(0, 1fr)';
	const template = $derived(columns.map(track).join(' '));
	const narrowTemplate = $derived(
		columns
			.filter((c) => !c.wide)
			.map(track)
			.join(' ')
	);
	// Filters of columns a narrow table drops; the first header offers them instead.
	const movedFilters = $derived(columns.filter((c) => c.wide && c.filterable));

	const built = new SvelteSet<string>();

	let filterOpen = $state(false);
	let filterColumn = $state<DataColumn<K>>();
	let filterAnchor = $state<HTMLElement>();

	function openFilter(column: DataColumn<K>, event: MouseEvent) {
		filterColumn = column;
		filterAnchor = event.currentTarget as HTMLElement;
		filterOpen = true;
	}

	function ariaSort(column: DataColumn<K>) {
		if (!column.sortable) return undefined;
		return sort?.column === column.id ? sort.direction : 'none';
	}
</script>

{#snippet filterButton(column: DataColumn<K>)}
	<button
		type="button"
		class="filter"
		class:on={column.filtered}
		aria-haspopup="dialog"
		aria-label="Filter {column.label}{column.filtered ? ' (set)' : ''}"
		onclick={(e) => openFilter(column, e)}
	>
		<Icon name="filter" />
	</button>
{/snippet}

<!--
	One table for the whole app (Scripts, Reference). Rows are grid rows with the same fixed
	tracks, so every row lines up without table layout, and `content-visibility` lets the
	browser skip rows off screen: sorting 181 Reference rows went from about 1.2 s to 0.2 s
	at 4x CPU throttling. Sort and filter controls sit in the header row itself.
-->
<div
	class="data-table {narrow}"
	class:fit-content={fit === 'content'}
	class:fill
	style:--columns={template}
	style:--columns-narrow={narrowTemplate}
	style:--row-estimate={rowEstimate}
>
	<div
		class="scroll"
		role={fit === 'content' ? 'region' : undefined}
		aria-label={fit === 'content' ? `${label} table` : undefined}
	>
		<table aria-label={label} data-testid={testid}>
			<thead>
				<tr>
					{#each columns as column, i (column.id)}
						<th
							scope="col"
							data-col={column.id}
							class:wide={column.wide}
							class:end={column.align === 'end'}
							class:control={column.sortable || column.filterable}
							aria-sort={ariaSort(column)}
						>
							<div class="head">
								{#if column.sortable}
									<button type="button" class="sort" onclick={() => onSort?.(column.id)}>
										<span class="label">{column.label}</span>
										{#if sort?.column === column.id}
											<Icon
												name={sort.direction === 'ascending' ? 'sortAscending' : 'sortDescending'}
											/>
										{:else}
											<span class="unsorted"><Icon name="sort" /></span>
										{/if}
									</button>
								{:else}
									<span class="plain" class:visually-hidden={column.hideLabel}>{column.label}</span>
								{/if}
								{#if column.filterable && filter}
									{@render filterButton(column)}
								{/if}
								{#if i === 0 && narrow === 'hide' && filter}
									{#each movedFilters as moved (moved.id)}
										<span class="narrow-only">{@render filterButton(moved)}</span>
									{/each}
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (key(row))}
					{@const id = key(row)}
					<tr
						{...rowAttrs?.(row)}
						class:selected={rowSelected?.(row)}
						{@attach lazy && near(() => built.add(id))}
					>
						{#each columns as column (column.id)}
							{#if column.rowHeader}
								<th scope="row" data-col={column.id}>{@render cell(row, column)}</th>
							{:else}
								<td
									data-col={column.id}
									data-label={column.label}
									class:wide={column.wide}
									class:end={column.align === 'end'}
									class:stack-head={column.stackHead}
									class:flush={column.flush}
								>
									{#if !lazy || built.has(id)}{@render cell(row, column)}{/if}
								</td>
							{/if}
						{/each}
					</tr>
				{:else}
					<tr class="empty"><td colspan={columns.length}>{empty}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if filter}
	<Popover bind:open={filterOpen} anchor={filterAnchor} title="Filter {filterColumn?.label ?? ''}">
		{#if filterColumn}{@render filter(filterColumn, () => (filterOpen = false))}{/if}
	</Popover>
{/if}

<style>
	.data-table {
		container: data-table / inline-size;
		min-width: 0;
	}
	.scroll {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.fill {
		height: 100%;
	}
	.fill .scroll {
		height: 100%;
		overflow: hidden auto;
		overscroll-behavior: contain;
	}
	.fill thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}
	table,
	thead,
	tbody {
		display: block;
	}
	table {
		width: 100%;
	}
	.fit-content table {
		width: max-content;
		min-width: 100%;
	}
	tr {
		display: grid;
		grid-template-columns: var(--columns);
		border-bottom: 1px solid var(--border);
	}
	/* Rows off screen skip layout and paint; `auto` remembers each row's real height. */
	tbody tr {
		content-visibility: auto;
		contain-intrinsic-block-size: auto var(--row-estimate);
	}
	th,
	td {
		min-width: 0;
		padding: var(--space-1) var(--space-2);
		text-align: start;
	}
	.end {
		text-align: end;
	}
	td.flush {
		padding: 0;
	}
	tr.selected {
		background: var(--surface-selected);
	}
	thead {
		background: var(--surface-selected);
	}
	thead tr {
		border-bottom: var(--card-border);
	}
	thead th {
		display: flex;
		align-items: flex-end;
		padding: 0;
	}
	.head {
		display: flex;
		align-items: center;
		width: 100%;
		min-width: 0;
	}
	.end .head {
		justify-content: flex-end;
	}
	.sort,
	.plain {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 0 1 auto;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		text-align: start;
		/* Long labels (Starting alignment) wrap between words inside their fixed column. */
		overflow-wrap: break-word;
		--icon-size: calc(0.95 * var(--u));
	}
	.end .sort {
		justify-content: flex-end;
	}
	.sort {
		cursor: pointer;
	}
	.sort:hover,
	th[aria-sort='ascending'] .sort,
	th[aria-sort='descending'] .sort {
		color: var(--heading);
	}
	.unsorted {
		display: inline-flex;
		opacity: 0.45;
	}
	.filter {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--on-surface-muted);
		cursor: pointer;
		opacity: 0.6;
		--icon-size: calc(1 * var(--u));
	}
	.filter:hover {
		opacity: 1;
	}
	.filter.on {
		background: var(--accent);
		color: var(--on-accent);
		opacity: 1;
	}
	.narrow-only {
		display: none;
	}
	tbody th {
		font-weight: 600;
	}
	.empty td {
		grid-column: 1 / -1;
		padding: var(--space-4);
		color: var(--on-surface-muted);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@container data-table (max-width: 40rem) {
		/* `hide`: the wide columns go; their filters sit in the first header. */
		.hide tr {
			grid-template-columns: var(--columns-narrow);
		}
		.hide .wide {
			display: none;
		}
		.hide .narrow-only {
			display: contents;
		}

		/* `stack`: the same fields as the table, each with its label, one block per row. */
		.stack .scroll {
			overflow-x: visible;
			border: 0;
			border-radius: 0;
			background: none;
		}
		.stack table {
			width: auto;
			min-width: 0;
		}
		.stack thead {
			background: none;
		}
		.stack thead tr {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-1);
			margin-bottom: var(--space-2);
			border: 0;
		}
		/* Columns with no control are labelled on each row's fields instead. */
		.stack thead th:not(.control) {
			display: none;
		}
		.stack thead th .head {
			border: var(--card-border);
			border-radius: var(--radius-full);
			background: var(--card-background);
		}
		.stack .filter {
			border-radius: var(--radius-full);
		}
		.stack tbody tr {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			margin-bottom: var(--space-3);
			padding: var(--space-2);
			border: var(--card-border);
			border-radius: var(--card-radius);
			background: var(--card-background);
		}
		/* As on the cards: the value sits beside its label when there is room, else under it. */
		.stack tbody td:not(.stack-head) {
			grid-column: 1 / -1;
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: var(--space-1) var(--space-2);
		}
		.stack tbody td:not(.stack-head)::before {
			content: attr(data-label);
			color: var(--on-surface-muted);
			font-size: 0.75rem;
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}
		.stack .empty td::before {
			content: none;
		}
	}
</style>
