<script lang="ts" module>
	import type { FilterKind, FilterValue } from '#lib/ui/table/column-filter.ts';

	export type SortDirection = 'ascending' | 'descending';

	interface ColumnBase<K extends string> {
		id: K;
		label: string;
		/** A CSS grid track. Fixed widths keep columns the same whichever rows are drawn. */
		width?: string;
		sortable?: boolean;
		/** With `filterable`: its own filter is set (the button is highlighted). */
		filtered?: boolean;
		/** With `value`: the filter to use instead of the one its values suggest. */
		filterKind?: FilterKind;
		/** The rows' first cell: a row header (`th scope="row"`), always built. */
		rowHeader?: boolean;
		align?: 'start' | 'end';
		/** The header shows no visible label (it stays the accessible name). */
		hideLabel?: boolean;
		/** `narrow="hide"`: dropped on a narrow table; its filter moves to the first header. */
		wide?: boolean;
		/** `wide`, and also dropped on a medium table (under 48rem, e.g. Search on a tablet). */
		wider?: boolean;
		/** The cell has no padding: its content (a full-size button) fills it. */
		flush?: boolean;
		/** `narrow="stack"`: stays on the row's first line, beside the row header, unlabelled. */
		stackHead?: boolean;
		/**
		 * `narrow="hide"`: a narrow table gives the first column the row's whole first line and
		 * puts the `secondLine` columns side by side on a second line under it (Trevor,
		 * 2026-10-19: Search's names were cut to three letters on a phone). Set it on every
		 * column a narrow table keeps but the first.
		 */
		secondLine?: boolean;
		/** With `resizeKey`: this column keeps its width (no drag handle). */
		fixed?: boolean;
		/** With `resizeKey`: the narrowest it can be dragged, in --u (default MIN_WIDTH). */
		minWidth?: number;
		/** Can't be hidden from the Columns list (a row's own controls, such as a tick box). */
		alwaysShown?: boolean;
	}

	/**
	 * Every column filters (Trevor, 2026-10-18: all columns get the same filter and search).
	 * Most give a plain `value` per row and the table builds the filter (column-filter.ts); a
	 * column with its own filter sets `filterable` and the table's `filter` snippet draws it;
	 * a column with no filter says why in `noFilter`.
	 */
	export type DataColumn<K extends string = string, T = unknown> = ColumnBase<K> &
		(
			| { value(row: T): FilterValue; filterable?: never; noFilter?: never }
			| { filterable: true; value?: never; noFilter?: never }
			| { noFilter: string; value?: never; filterable?: never }
		);

	export interface DataSort<K extends string = string> {
		column: K;
		direction: SortDirection;
	}
</script>

<script lang="ts" generics="T, K extends string">
	import { untrack, type Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { near } from '#lib/ui/near.ts';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import {
		EMPTY,
		applyFilters,
		filterKindOf,
		isActive,
		pickOptions,
		readBound,
		type ColumnFilter,
		type FilterValue as Value
	} from '#lib/ui/table/column-filter.ts';
	import { HiddenColumns, TableWidths } from '#lib/ui/table/column-widths.svelte.ts';
	import FilterOptions from '#lib/ui/table/FilterOptions.svelte';
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
		columns: readonly DataColumn<K, NoInfer<T>>[];
		/** Already filtered and sorted (the pure functions live with each feature's data). */
		rows: readonly T[];
		key: (row: T) => string;
		cell: Snippet<[T, DataColumn<K, T>]>;
		sort?: DataSort<K>;
		onSort?: (column: K) => void;
		/** Columns' own filters (`filterable`), in a popover from the header; `close` shuts it. */
		filter?: Snippet<[DataColumn<K, T>, () => void]>;
		/** The filters the table builds for `value` columns, by column. */
		columnFilters?: Partial<Record<K, ColumnFilter>>;
		/** Told how many rows are left after those filters, whenever it changes. */
		oncount?: (count: number) => void;
		/**
		 * People can hide columns (Trevor, 2026-10-18); the choice is remembered on this device
		 * under this name. Defaults to `resizeKey`; without either it lasts until reload.
		 */
		hideKey?: string;
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
		/** The same for a narrow table's two-line rows (`secondLine`); one line more by default. */
		twoLineRowEstimate?: string;
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
		/** With `lazy`: plain text for a row header until the row comes near the screen. */
		rowLabel?: (row: T) => string;
		/**
		 * Draws this many rows, then the next as many each time the end comes near (Trevor,
		 * 2026-10-18: one shared paged table for everything search lists). Unset draws all.
		 */
		pageSize?: number;
		/**
		 * No box of its own: the table sits flush in a frame that already has one (Trevor,
		 * 2026-10-18, the Library: "doesn't need to be a separate instance with space between
		 * the walls").
		 */
		frameless?: boolean;
		/**
		 * Rows still to come from elsewhere (a site's next pages): their space is kept below
		 * the drawn rows, and `onend` is called when it comes near.
		 */
		moreRows?: number;
		onend?: () => void;
	}

	let {
		label,
		columns: allColumns,
		rows: allRows,
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
		twoLineRowEstimate = `calc(${rowEstimate} + 1.75rem)`,
		rowAttrs,
		rowSelected,
		empty = 'None',
		testid,
		resizeKey,
		rowLabel,
		pageSize,
		frameless = false,
		moreRows = 0,
		onend,
		columnFilters = $bindable({}),
		oncount,
		hideKey
	}: Props = $props();

	/** The row header, else the first column: it names the row, so it can't be hidden. */
	const fixedColumn = $derived(allColumns.find((c) => c.rowHeader) ?? allColumns[0]);
	const hidden = $derived(new HiddenColumns(hideKey ?? resizeKey ?? ''));
	const keeps = (c: DataColumn<K, T>) => c === fixedColumn || !!c.alwaysShown;
	const columns = $derived(allColumns.filter((c) => keeps(c) || !hidden.has(c.id)));
	const canFilter = (column: DataColumn<K, T>) =>
		!!column.value || (!!column.filterable && !!filter);
	const isFiltered = (column: DataColumn<K, T>) =>
		column.filterable ? !!column.filtered : isActive(columnFilters[column.id]);

	function setHidden(id: string, hide: boolean) {
		hidden.set(id, hide);
		// A hidden column's filter would keep rows out with nothing on screen to say so.
		if (hide && id in columnFilters) setFilter(id as K, undefined);
	}

	function setFilter(id: K, value: ColumnFilter | undefined) {
		const next = { ...columnFilters };
		if (value && isActive(value)) next[id] = value;
		else delete next[id];
		columnFilters = next;
	}

	const valueColumns = $derived(new Map(allColumns.map((c) => [c.id as string, c])));
	const rows = $derived(
		applyFilters(allRows, columnFilters, (row, id): Value => valueColumns.get(id)?.value?.(row))
	);
	$effect.pre(() => {
		oncount?.(rows.length);
	});

	const widths = $derived(resizeKey ? new TableWidths(resizeKey) : undefined);
	const resizable = (column: DataColumn<K, T>) => !!widths && !column.fixed;
	const track = (column: DataColumn<K, T>) => column.width ?? 'minmax(0, 1fr)';
	const dragged = (column: DataColumn<K, T>) =>
		resizable(column) ? widths?.current[column.id] : undefined;
	/** The header padding the handles take in column `i` (see `th.resizable` below), in --hit. */
	function room(i: number): string | undefined {
		const end = resizable(columns[i]) ? (i === columns.length - 1 ? 1 : 0.5) : 0;
		const start = i > 0 && resizable(columns[i - 1]) ? 0.5 : 0;
		return end + start ? `${end + start} * var(--hit)` : undefined;
	}
	// Dragged widths apply to the full table only; narrow tables keep their own tracks.
	// A resizable column also gets room for its handle, so its header keeps its width.
	const tracks = $derived(columns.map((c, i) => columnTrack(dragged(c), track(c), room(i))));
	const template = $derived(tracks.join(' '));
	const flexible = (track: string) => /fr|%|minmax|auto|content/.test(track);
	/**
	 * Where each column that stays in view sideways starts: the columns up to and including
	 * the row header (Reference: icon and name), else just the first. Offsets need fixed widths.
	 */
	const stickyStarts = $derived.by(() => {
		const header = columns.findIndex((c) => c.rowHeader);
		const last = header > 0 && !tracks.slice(0, header).some(flexible) ? header : 0;
		return tracks
			.slice(0, last + 1)
			.map((_, i) => (i === 0 ? '0rem' : `calc(${tracks.slice(0, i).join(' + ')})`));
	});
	const mediumTemplate = $derived(tracks.filter((_, i) => !columns[i].wider).join(' '));
	const secondLine = $derived(columns.filter((c) => c.secondLine && !c.wide && !c.wider));
	// Two lines: the second line's tracks, its first column taking what the others leave.
	const narrowTemplate = $derived(
		secondLine.length > 0
			? secondLine.map((c, i) => (i === 0 ? 'minmax(0, 1fr)' : track(c))).join(' ')
			: columns
					.filter((c) => !c.wide && !c.wider)
					.map(track)
					.join(' ')
	);
	// Filters of columns a narrow table drops; the first header offers them instead.
	const movedFilters = $derived(columns.filter((c) => (c.wide || c.wider) && canFilter(c)));

	const built = new SvelteSet<string>();
	let body = $state<HTMLElement>();

	/**
	 * Rows on or near the screen are built before the browser paints, whenever the rows
	 * change (first show, sort, filter): the observer in near.ts only reports after a paint,
	 * which showed each visible row's name a frame before the rest of it. The observer still
	 * builds rows as they come near while scrolling.
	 */
	// `fit="content"`: a wide table scrolls inside its own box, no taller than the screen, so
	// its sideways scrollbar is always in reach (Trevor, 2026-10-16). Narrow tables (stacked
	// rows on phones) are not boxed: they scroll with the page and never sideways.
	let scroller = $state<HTMLElement>();
	let narrowNow = $state(false);
	const boxed = $derived(fit === 'content' && !narrowNow);
	/** Rows are "near" relative to the box they scroll in: the table's own, or the page. */
	const root = $derived(boxed ? (scroller ?? null) : null);

	/**
	 * Paging: building thousands of rows at once took about 4 s on a phone (Bloodstar's 4,682
	 * scripts). A new list starts at one page again; a list that only grew at its end (BotC
	 * Scripts' next page) keeps what is drawn, so nothing jumps while scrolling.
	 */
	let limit = $state(Infinity);
	let firstKey: string | undefined;
	$effect.pre(() => {
		const first = rows.length ? key(rows[0]) : undefined;
		if (first !== firstKey || untrack(() => limit) === Infinity) {
			limit = pageSize ?? Infinity;
			// A new list starts at its top, or the old scroll position would draw page after page.
			const box = untrack(() => scroller);
			if (pageSize && fill && box) box.scrollTop = 0;
		}
		firstKey = first;
	});
	const drawn = $derived(limit < rows.length ? rows.slice(0, limit) : rows);
	/** Rows not drawn yet, here or still to come: the space kept for them below. */
	const undrawn = $derived(rows.length - drawn.length + Math.max(0, moreRows));

	/**
	 * The space kept for undrawn rows came near. The list never ends early, so a scroll in
	 * flight never stops at the end of a page (Trevor, 2026-10-18: Search only went on once he
	 * let go). Enough pages are drawn to reach past the screen, however far it jumped.
	 */
	function reachEnd(space: Element) {
		if (drawn.length >= rows.length) {
			onend?.();
			return;
		}
		const size = pageSize ?? Infinity;
		const box = space.getBoundingClientRect();
		const view = root ? root.getBoundingClientRect() : { top: 0, bottom: innerHeight };
		const rowHeight = box.height / Math.max(1, undrawn);
		const past = view.bottom + (view.bottom - view.top) - box.top;
		const pages = Math.max(1, Math.ceil(past / rowHeight / size));
		limit += pages * size;
	}

	/** Tracks the same 40rem limit as the container query below. */
	function watchWidth(element: HTMLElement) {
		const check = () => {
			const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
			narrowNow = element.getBoundingClientRect().width <= 40 * rem;
		};
		// Now, so the first rows are measured against the right box.
		check();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(check);
		observer.observe(element);
		return () => observer.disconnect();
	}

	/**
	 * Rows on or near the screen are built before the browser paints, whenever the rows
	 * change (first show, sort, filter): the observer in near.ts only reports after a paint,
	 * which showed each visible row's name a frame before the rest of it. The observer still
	 * builds rows as they come near while scrolling.
	 */
	$effect(() => {
		void rows;
		if (!lazy || !body) return;
		// Only what is on screen (and a little more) before the paint; near.ts builds further
		// ahead after it, so a sort or the first show costs no more than the visible rows.
		const scrolls = root && root.scrollHeight > root.clientHeight;
		const view = scrolls ? root.getBoundingClientRect() : { top: 0, bottom: innerHeight };
		const reach = (view.bottom - view.top) / 4;
		for (const tr of body.children as HTMLCollectionOf<HTMLElement>) {
			const key = tr.dataset.rowKey;
			if (key === undefined || built.has(key)) continue;
			const box = tr.getBoundingClientRect();
			if (box.top > view.bottom + reach) break;
			if (box.bottom > view.top - reach) built.add(key);
		}
	});

	let filterOpen = $state(false);
	let filterColumn = $state<DataColumn<K, T>>();
	let filterAnchor = $state<HTMLElement>();

	let pickerOpen = $state(false);
	let pickerAnchor = $state<HTMLElement>();

	function openFilter(column: DataColumn<K, T>, event: MouseEvent) {
		filterColumn = column;
		filterAnchor = event.currentTarget as HTMLElement;
		filterOpen = true;
	}

	/** A CSS width in pixels here (--u follows the app's text size). */
	function px(width: string, inside: HTMLElement): number {
		const probe = document.createElement('div');
		// Out of flow, so a flex parent can't shrink it.
		probe.style.cssText = `position: absolute; visibility: hidden; width: ${width}`;
		inside.append(probe);
		const result = probe.getBoundingClientRect().width;
		probe.remove();
		return result;
	}

	const minOf = (column: DataColumn<K, T>) => column.minWidth ?? MIN_WIDTH;

	/** The column's width now, in --u: its dragged width, else what its header measures. */
	function widthNow(
		column: DataColumn<K, T>,
		handle: HTMLElement
	): { width: number; unit: number } {
		const th = handle.closest('th') as HTMLElement;
		const unit = px('var(--u)', th) || 16;
		// The handle's room is added on top of the stored width (columnTrack).
		const index = columns.indexOf(column);
		const handles = px(`calc(${room(index) ?? '0px'})`, th);
		const measured = (th.getBoundingClientRect().width - handles) / unit;
		return { width: widths?.current[column.id] ?? measured, unit };
	}

	const rtl = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl';

	let resizing = $state<K>();
	let drag:
		| { pointer: number; startX: number; start: number; unit: number; sign: number; moved: boolean }
		| undefined;
	let pending: number | undefined;
	let frame = 0;
	let lastTap: { column: K; time: number } | undefined;

	function startResize(column: DataColumn<K, T>, event: PointerEvent) {
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

	function moveResize(column: DataColumn<K, T>, event: PointerEvent) {
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

	function endResize(column: DataColumn<K, T>, event: PointerEvent) {
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

	function keyResize(column: DataColumn<K, T>, event: KeyboardEvent) {
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

	function ariaSort(column: DataColumn<K, T>) {
		if (!column.sortable) return undefined;
		return sort?.column === column.id ? sort.direction : 'none';
	}
</script>

{#snippet filterButton(column: DataColumn<K, T>, labelled = false)}
	<button
		type="button"
		class="filter"
		class:labelled
		class:on={isFiltered(column)}
		aria-haspopup="dialog"
		aria-label="Filter {column.label}{isFiltered(column) ? ' (set)' : ''}"
		onclick={(e) => openFilter(column, e)}
	>
		<!-- Moved filters carry their column's name, so several in one header stay distinct. -->
		{#if labelled}<span class="filter-label" aria-hidden="true">{column.label}</span>{/if}
		<Icon name="filter" />
	</button>
{/snippet}

<!-- Hides and shows columns. `wideOnly`: a narrow table has it on its row of moved filters. -->
{#snippet columnsButton(wideOnly = false)}
	<button
		type="button"
		class="filter columns-button"
		class:wide-only={wideOnly}
		class:on={hidden.count > 0}
		aria-haspopup="dialog"
		aria-label="Columns{hidden.count > 0 ? ' (some hidden)' : ''}"
		onclick={(e) => {
			pickerAnchor = e.currentTarget;
			pickerOpen = true;
		}}
	>
		<Icon name="columns" />
	</button>
{/snippet}

<!-- The filter the table builds from a column's values (column-filter.ts). -->
{#snippet builtFilter(column: DataColumn<K, T>, close: () => void)}
	{@const values = column.value ? allRows.map(column.value) : []}
	{@const current = columnFilters[column.id]}
	{@const kind = current?.kind ?? column.filterKind ?? filterKindOf(values)}
	{#if kind === 'pick'}
		{@const ticked = current?.kind === 'pick' ? current.values : []}
		<FilterOptions
			legend={column.label}
			hideLegend
			options={pickOptions(values).map((v) => ({ value: v, label: v === EMPTY ? empty : v }))}
			values={ticked}
			ontoggle={(v, on) =>
				setFilter(column.id, {
					kind: 'pick',
					values: on ? [...ticked, v] : ticked.filter((x) => x !== v)
				})}
			{empty}
		/>
	{:else if kind === 'text'}
		<SearchField
			label="Search {column.label}"
			value={current?.kind === 'text' ? current.text : ''}
			oninput={(text) => setFilter(column.id, { kind: 'text', text })}
			oncommit={() => {
				close();
			}}
		/>
	{:else}
		{@const range: Extract<ColumnFilter, { kind: 'range' }> =
			current?.kind === 'range' ? current : { kind: 'range' }}
		<div class="range">
			<TextField
				label="Lowest"
				inputmode="decimal"
				value={range.min === undefined ? '' : String(range.min)}
				oninput={(text) => setFilter(column.id, { ...range, min: readBound(text) })}
				oncommit={close}
			/>
			<TextField
				label="Highest"
				inputmode="decimal"
				value={range.max === undefined ? '' : String(range.max)}
				oninput={(text) => setFilter(column.id, { ...range, max: readBound(text) })}
				oncommit={close}
			/>
		</div>
	{/if}
{/snippet}

<!--
	One table for the whole app (Scripts, Reference). Rows are grid rows with the same fixed
	tracks, so every row lines up without table layout, and `content-visibility` lets the
	browser skip rows off screen: sorting 181 Reference rows went from about 1.2 s to 0.2 s
	at 4x CPU throttling. Sort and filter controls sit in the header row itself.
-->
<div
	class="data-table {narrow}"
	class:two-line={narrow === 'hide' && secondLine.length > 0}
	class:fit-content={fit === 'content'}
	class:boxed
	class:frameless
	class:fill
	class:lazy
	style:--columns={template}
	style:--columns-medium={mediumTemplate}
	style:--columns-narrow={narrowTemplate}
	style:--row-estimate-line={rowEstimate}
	style:--row-estimate-two-line={twoLineRowEstimate}
	{@attach fit === 'content' && watchWidth}
>
	<div
		class="scroll"
		role={fit === 'content' ? 'region' : undefined}
		aria-label={fit === 'content' ? `${label} table` : undefined}
		bind:this={scroller}
	>
		<table aria-label={label} data-testid={testid}>
			<thead>
				<tr>
					{#each columns as column, i (column.id)}
						<th
							scope="col"
							data-col={column.id}
							class:wide={column.wide}
							class:wider={column.wider}
							class:end={column.align === 'end'}
							class:control={column.sortable || canFilter(column) || column === fixedColumn}
							class:resizable={resizable(column)}
							class:after-resizable={i > 0 && resizable(columns[i - 1])}
							class:last={i === columns.length - 1}
							class:sticky={i < stickyStarts.length}
							class:sticky-end={i === stickyStarts.length - 1}
							style:--sticky-start={stickyStarts[i]}
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
								{#if canFilter(column)}
									{@render filterButton(column)}
								{/if}
								{#if column === fixedColumn && allColumns.length > 1}
									{@render columnsButton(narrow === 'hide')}
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
					{#if narrow === 'hide'}
						<!--
							A narrow table's dropped columns keep their filters, with Columns, on one
							wrapping row under the header (Trevor, 2026-10-18: they stacked up in Name).
						-->
						<th class="moved" class:has-medium={movedFilters.some((c) => c.wider)}>
							<div class="head">
								{#each movedFilters as moved (moved.id)}
									<span class={moved.wider ? 'medium-only' : 'narrow-only'}
										>{@render filterButton(moved, true)}</span
									>
								{/each}
								{#if allColumns.length > 1}<span class="narrow-only">{@render columnsButton()}</span
									>{/if}
							</div>
						</th>
					{/if}
				</tr>
			</thead>
			<tbody bind:this={body}>
				{#each drawn as row (key(row))}
					{@const id = key(row)}
					{@const ready = !lazy || built.has(id)}
					<!--
						A row far from the screen is only its row header: no empty cells, so switching
						to the table or re-sorting creates a few hundred elements, not a few thousand.
					-->
					<tr
						{...rowAttrs?.(row)}
						data-row-key={lazy ? id : undefined}
						class:selected={rowSelected?.(row)}
						class:pending={!ready}
						{@attach lazy && near(() => built.add(id), undefined, root)}
					>
						{#each columns as column, c (column.id)}
							{#if column.rowHeader}
								<th
									scope="row"
									data-col={column.id}
									class:sticky={c < stickyStarts.length}
									class:sticky-end={c === stickyStarts.length - 1}
									style:--sticky-start={stickyStarts[c]}
									style:--col={ready ? undefined : c + 1}
									>{#if ready || !rowLabel}{@render cell(row, column)}{:else}{rowLabel(
											row
										)}{/if}</th
								>
							{:else if ready}
								<td
									data-col={column.id}
									data-label={column.label}
									class:wide={column.wide}
									class:wider={column.wider}
									class:end={column.align === 'end'}
									class:stack-head={column.stackHead}
									class:flush={column.flush}
									class:sticky={c < stickyStarts.length}
									class:sticky-end={c === stickyStarts.length - 1}
									style:--sticky-start={stickyStarts[c]}
								>
									{@render cell(row, column)}
								</td>
							{/if}
						{/each}
					</tr>
				{:else}
					<tr class="empty"><td colspan={columns.length}>{empty}</td></tr>
				{/each}
				{#if undrawn > 0}
					<!-- Comes near the screen: more rows are drawn (a new watcher each time). -->
					{#key drawn.length}
						<tr
							class="more-rows"
							aria-hidden="true"
							style:--undrawn={undrawn}
							{@attach (space) => near(() => reachEnd(space), '200% 0px', root)(space)}
						></tr>
					{/key}
				{/if}
			</tbody>
		</table>
	</div>
</div>

<Popover bind:open={filterOpen} anchor={filterAnchor} title="Filter {filterColumn?.label ?? ''}">
	{#if filterColumn?.filterable && filter}
		{@render filter(filterColumn, () => (filterOpen = false))}
	{:else if filterColumn}
		{@render builtFilter(filterColumn, () => (filterOpen = false))}
	{/if}
</Popover>

<Popover bind:open={pickerOpen} anchor={pickerAnchor} title="Columns">
	<FilterOptions
		legend="Columns"
		hideLegend
		options={allColumns.map((c) => ({
			value: c.id,
			label: c.label,
			disabled: keeps(c)
		}))}
		values={columns.map((c) => c.id)}
		ontoggle={(id, on) => setHidden(id, !on)}
	/>
</Popover>

<style>
	.data-table {
		/* A resize handle's width: a full tap target for touch, narrower for a mouse. */
		--hit: var(--tap-target);
		container: data-table / inline-size;
		min-width: 0;
		/* Keeps the sticky header and pinned cells' z-index inside the table, so a sticky
		   heading around it (a Settings section's) stays on top while the table scrolls under. */
		isolation: isolate;
	}
	.scroll {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.frameless .scroll {
		border: 0;
		border-radius: 0;
		background: none;
	}
	.fill {
		height: 100%;
	}
	.fill .scroll {
		height: 100%;
		/* Both ways: resized columns can make the table wider than its box. */
		overflow: auto;
		overscroll-behavior: contain;
	}
	/* Above pinned cells (z-index 2), which rows stack even where they don't stick. */
	.fill thead {
		position: sticky;
		top: 0;
		z-index: 3;
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
	.boxed .scroll {
		/* The screen below the app header: the sideways scrollbar is always on screen. */
		max-height: calc(100dvh - var(--tap-target) - env(safe-area-inset-top) - var(--space-4));
		overflow: auto;
		/* Sideways stays in the box; at the top or bottom, the page carries on scrolling. */
		overscroll-behavior: contain auto;
	}
	.boxed thead {
		position: sticky;
		top: 0;
		z-index: 3;
	}
	/* The row's name (and anything before it) stays in view while the rest scrolls sideways. */
	.sticky {
		position: sticky;
		inset-inline-start: var(--sticky-start);
		z-index: 1;
		background: var(--card-background);
	}
	/* A line where the scrolling columns slide under. */
	.sticky-end {
		box-shadow: inset -1px 0 var(--border);
	}
	/*
	 * Pinned header cells sit above the scrolling ones, resize lines included (Trevor,
	 * 2026-10-18: header lines showed over the pinned columns when scrolled sideways).
	 */
	thead .sticky {
		z-index: 3;
	}
	tbody .sticky {
		z-index: 2;
	}
	thead .sticky,
	tr.selected > .sticky {
		background:
			linear-gradient(var(--surface-selected), var(--surface-selected)), var(--card-background);
	}
	tr {
		display: grid;
		grid-template-columns: var(--columns);
		border-bottom: 1px solid var(--border);
	}
	/*
	 * Lazy tables' rows off screen skip layout and paint; `auto` remembers each row's real
	 * height. Only there: Search's rows on a phone didn't follow a swipe until the finger
	 * lifted (Trevor, 2026-10-18), and light rows gain nothing from skipping.
	 */
	table {
		--row-estimate: var(--row-estimate-line);
	}
	.lazy tbody tr {
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
	/*
	 * A table that fits its box (Scripts) has no room for touch-sized handles beside its
	 * columns, so on touch screens it keeps its own widths and shows no handles.
	 */
	@media (pointer: coarse) {
		.data-table:not(.fit-content) {
			--hit: 0rem;
		}
		.data-table:not(.fit-content) .resize {
			display: none;
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
	/*
	 * A header keeps its label, sort arrows and filter on one line (Trevor, 2026-10-18: Author's
	 * buttons dropped under its label); columns are sized to fit them. A narrow table puts the
	 * filters of the columns it drops on their own row (`.moved`).
	 */
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
		max-width: 100%;
		--icon-size: calc(0.95 * var(--u));
	}
	/*
	 * Labels stay on one line (Trevor, 2026-10-18: Starting alignment took two); columns are
	 * sized to fit them, and one dragged narrower cuts its label short.
	 */
	.label,
	.plain {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.label {
		min-width: 0;
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
	.narrow-only,
	.medium-only,
	.moved {
		display: none;
	}
	/* The row of moved filters spans the table; it wraps if they don't fit on one line. */
	thead th.moved {
		grid-column: 1 / -1;
		border-top: 1px solid var(--border);
	}
	th.moved .head {
		flex-wrap: wrap;
	}
	/* The column picker sits at the end of the header of the column that can't be hidden. */
	.columns-button {
		margin-inline-start: auto;
	}
	.range {
		display: grid;
		gap: var(--space-2);
	}
	tbody th {
		font-weight: 600;
	}
	/* A row not built yet keeps its header in its own column. */
	tr.pending th {
		grid-column: var(--col);
	}
	.more-rows {
		height: calc(var(--undrawn) * var(--row-estimate));
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

	/* `hide` on a medium table: the `wider` columns go first; their filters move as below. */
	@container data-table (max-width: 48rem) {
		.hide tr {
			grid-template-columns: var(--columns-medium);
		}
		.hide .wider {
			display: none;
		}
		.hide .medium-only {
			display: contents;
		}
		.hide .moved.has-medium {
			display: flex;
		}
	}

	@container data-table (max-width: 40rem) {
		/* Narrow tables fit the screen as they are: nothing to resize. */
		.resize {
			display: none;
		}
		.boxed .scroll {
			max-height: none;
			overflow-y: visible;
		}
		.sticky,
		thead .sticky {
			position: static;
			background: none;
			box-shadow: none;
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
		.hide .wide,
		.hide .wider {
			display: none;
		}
		.hide .narrow-only,
		.hide .medium-only {
			display: contents;
		}
		.hide .moved {
			display: flex;
		}
		.hide .wide-only {
			display: none;
		}
		/* `secondLine`: the first column has the first line to itself; the rest wrap under it. */
		.two-line table {
			--row-estimate: var(--row-estimate-two-line);
		}
		.two-line tr > :first-child {
			grid-column: 1 / -1;
		}
		/* The second line sits close under the first: one row, not two. */
		.two-line tbody td:not(:first-child) {
			padding-top: 0;
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
		.stack tr.pending th {
			grid-column: auto;
		}
		.stack .empty td::before {
			content: none;
		}
	}
</style>
