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
		/** With `resizeKey`: this column keeps its width (no drag handle). */
		fixed?: boolean;
		/** With `resizeKey`: the narrowest it can be dragged, in --u (default MIN_WIDTH). */
		minWidth?: number;
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
	import { TableWidths } from '#lib/ui/table/column-widths.svelte.ts';
	import {
		KEY_STEP,
		MAX_WIDTH,
		MIN_WIDTH,
		clampWidth,
		columnTrack
	} from '#lib/ui/table/column-widths.ts';

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
		/**
		 * Columns can be resized by dragging their header's edge; the widths are remembered on
		 * this device under this name. Off on narrow tables, which never scroll sideways.
		 */
		resizeKey?: string;
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
		testid,
		resizeKey
	}: Props = $props();

	const widths = $derived(resizeKey ? new TableWidths(resizeKey) : undefined);
	const resizable = (column: DataColumn<K>) => !!widths && !column.fixed;
	const track = (column: DataColumn<K>) => column.width ?? 'minmax(0, 1fr)';
	// Dragged widths apply to the full table only; narrow tables keep their own tracks.
	const template = $derived(
		columns
			.map((c) => columnTrack(resizable(c) ? widths?.current[c.id] : undefined, track(c)))
			.join(' ')
	);
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

	/** One --u in pixels here (it follows the app's text size). */
	function unitPx(inside: HTMLElement): number {
		const probe = document.createElement('div');
		// Out of flow, so a flex parent can't shrink it.
		probe.style.cssText = 'position: absolute; visibility: hidden; width: var(--u)';
		inside.append(probe);
		const px = probe.getBoundingClientRect().width;
		probe.remove();
		return px || 16;
	}

	const minOf = (column: DataColumn<K>) => column.minWidth ?? MIN_WIDTH;

	/** The column's width now, in --u: its dragged width, else what its header measures. */
	function widthNow(column: DataColumn<K>, handle: HTMLElement): { width: number; unit: number } {
		const th = handle.closest('th') as HTMLElement;
		const unit = unitPx(th);
		return { width: widths?.current[column.id] ?? th.getBoundingClientRect().width / unit, unit };
	}

	const rtl = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl';

	let resizing = $state<K>();
	let drag:
		| { pointer: number; startX: number; start: number; unit: number; sign: number; moved: boolean }
		| undefined;
	let pending: number | undefined;
	let frame = 0;
	let lastTap: { column: K; time: number } | undefined;

	function startResize(column: DataColumn<K>, event: PointerEvent) {
		if (!widths || event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement;
		const { width, unit } = widthNow(column, handle);
		drag = {
			pointer: event.pointerId,
			startX: event.clientX,
			start: width,
			unit,
			sign: rtl(handle) ? -1 : 1,
			moved: false
		};
		resizing = column.id;
		handle.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function moveResize(column: DataColumn<K>, event: PointerEvent) {
		if (!drag || drag.pointer !== event.pointerId) return;
		const dx = (event.clientX - drag.startX) * drag.sign;
		// A few pixels of wobble is still a tap (a double tap resets).
		if (!drag.moved && Math.abs(dx) < drag.unit / 4) return;
		drag.moved = true;
		pending = clampWidth(drag.start + dx / drag.unit, minOf(column));
		// One relayout per frame however fast the pointer moves.
		frame ||= requestAnimationFrame(() => {
			frame = 0;
			if (pending !== undefined) widths?.set(column.id, pending, false);
		});
	}

	function endResize(column: DataColumn<K>, event: PointerEvent) {
		if (!drag || drag.pointer !== event.pointerId) return;
		const moved = drag.moved;
		drag = undefined;
		resizing = undefined;
		if (moved) {
			cancelAnimationFrame(frame);
			frame = 0;
			if (pending !== undefined) widths?.set(column.id, pending);
			pending = undefined;
			lastTap = undefined;
			return;
		}
		if (event.type !== 'pointerup') return;
		// Double tap or double click: back to the column's own width.
		if (lastTap?.column === column.id && event.timeStamp - lastTap.time < 400) {
			widths?.reset(column.id);
			lastTap = undefined;
		} else {
			lastTap = { column: column.id, time: event.timeStamp };
		}
	}

	function keyResize(column: DataColumn<K>, event: KeyboardEvent) {
		const handle = event.currentTarget as HTMLElement;
		if (event.key === 'Enter') {
			widths?.reset(column.id);
			event.preventDefault();
			return;
		}
		const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
		if (!direction) return;
		event.preventDefault();
		const { width } = widthNow(column, handle);
		const step = direction * (rtl(handle) ? -1 : 1) * KEY_STEP * (event.shiftKey ? 4 : 1);
		widths?.set(column.id, clampWidth(width + step, minOf(column)));
	}

	function ariaSort(column: DataColumn<K>) {
		if (!column.sortable) return undefined;
		return sort?.column === column.id ? sort.direction : 'none';
	}
</script>

{#snippet filterButton(column: DataColumn<K>, labelled = false)}
	<button
		type="button"
		class="filter"
		class:labelled
		class:on={column.filtered}
		aria-haspopup="dialog"
		aria-label="Filter {column.label}{column.filtered ? ' (set)' : ''}"
		onclick={(e) => openFilter(column, e)}
	>
		<!-- Moved filters carry their column's name, so several in one header stay distinct. -->
		{#if labelled}<span class="filter-label" aria-hidden="true">{column.label}</span>{/if}
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
							class:resizable={resizable(column)}
							class:after-resizable={i > 0 && resizable(columns[i - 1])}
							class:last={i === columns.length - 1}
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
										<span class="narrow-only">{@render filterButton(moved, true)}</span>
									{/each}
								{/if}
							</div>
							{#if resizable(column)}
								<!-- A focusable separator is a widget (ARIA 1.2 window splitter); Svelte lists it as static. -->
								<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
								<span
									class="resize"
									class:last={i === columns.length - 1}
									class:active={resizing === column.id}
									role="separator"
									aria-orientation="vertical"
									aria-label="Resize {column.label}"
									aria-valuemin={minOf(column)}
									aria-valuemax={MAX_WIDTH}
									aria-valuenow={widths?.current[column.id]}
									tabindex="0"
									data-resize={column.id}
									onpointerdown={(e) => startResize(column, e)}
									onpointermove={(e) => moveResize(column, e)}
									onpointerup={(e) => endResize(column, e)}
									onpointercancel={(e) => endResize(column, e)}
									onkeydown={(e) => keyResize(column, e)}
								></span>
							{/if}
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
		/* A resize handle's width: a full tap target for touch, narrower for a mouse. */
		--hit: var(--tap-target);
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
		position: relative;
		display: flex;
		align-items: flex-end;
		padding: 0;
	}
	/*
	 * The drag handle straddles the header's end edge (inside it for the last column).
	 * A faint line shows where it is.
	 */
	@media (pointer: fine) {
		.data-table {
			--hit: calc(0.75 * var(--u));
		}
	}
	/* Each half of a handle has its own room, so it never covers a sort or filter button. */
	thead th.resizable {
		padding-inline-end: calc(0.5 * var(--hit));
	}
	thead th.resizable.last {
		padding-inline-end: var(--hit);
	}
	thead th.after-resizable {
		padding-inline-start: calc(0.5 * var(--hit));
	}
	.resize {
		position: absolute;
		inset-block: 0;
		inset-inline-end: calc(-0.5 * var(--hit));
		z-index: 2;
		display: flex;
		justify-content: center;
		width: var(--hit);
		cursor: col-resize;
		touch-action: none;
	}
	/* The last column's handle stays inside the table, so it never widens the scroll box. */
	.resize.last {
		inset-inline-end: 0;
		justify-content: flex-end;
	}
	.resize::after {
		content: '';
		width: calc(0.125 * var(--u));
		margin-block: var(--space-2);
		border-radius: var(--radius-full);
		background: var(--border);
	}
	.resize:hover::after,
	.resize:focus-visible::after,
	.resize.active::after {
		width: calc(0.25 * var(--u));
		background: var(--accent);
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
	.filter.labelled {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		width: auto;
		min-width: var(--tap-target);
		padding: 0 var(--space-2);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
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
		/* Narrow tables fit the screen as they are: nothing to resize. */
		.resize {
			display: none;
		}
		thead th.resizable,
		thead th.resizable.last,
		thead th.after-resizable {
			padding-inline: 0;
		}
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
		/* The first header wraps its moved filters onto a second line if they don't fit. */
		.hide .head {
			flex-wrap: wrap;
		}

		/* `stack`: the same fields as the table, each with its label, one block per row. */
		/* clip, not visible: tap areas past a word must not widen the box (no sideways scroll). */
		.stack .scroll {
			overflow-x: clip;
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
