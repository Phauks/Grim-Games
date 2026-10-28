/**
 * Every column filters the same way unless it brings its own (Trevor, 2026-10-18: "we don't
 * treat all columns equally with ability to filter/search"). A column gives the table a plain
 * value per row; the table picks the filter from what the values look like:
 * - a few different values: a list to tick any of (an empty value is "None");
 * - many numbers: a lowest and highest;
 * - many words: a contains search.
 * Pure helpers; DataTable keeps the state.
 */

/** What a column holds for one row, for filtering. A list matches if any item does. */
export type FilterValue = string | number | readonly string[] | null | undefined;

export type ColumnFilter =
	| { kind: 'text'; text: string }
	| { kind: 'pick'; values: readonly string[] }
	| { kind: 'range'; min?: number; max?: number };

export type FilterKind = ColumnFilter['kind'];

/** Up to this many different values, a column is a tick list. */
const PICK_LIMIT = 12;

/** The key an empty value is picked by ("None"). */
export const EMPTY = '';

function items(value: FilterValue): string[] {
	if (value === null || value === undefined) return [EMPTY];
	if (typeof value === 'number') return [String(value)];
	if (typeof value === 'string') return [value.trim()];
	return value.length ? value.map((v) => v.trim()) : [EMPTY];
}

/** The filter that fits these values. */
export function filterKindOf(values: readonly FilterValue[]): FilterKind {
	const distinct = new Set(values.flatMap(items));
	if (distinct.size <= PICK_LIMIT) return 'pick';
	const numbers = values.every((v) => v === null || v === undefined || typeof v === 'number');
	return numbers ? 'range' : 'text';
}

/** Each different value once, empty ("None") first, then in reading or number order. */
export function pickOptions(
	values: readonly FilterValue[],
	ticked: readonly string[] = []
): string[] {
	// A ticked value stays offered though no row has it now, so it can still be unticked.
	const distinct = [...new Set([...values.flatMap(items), ...ticked])];
	const numeric = values.some((v) => typeof v === 'number');
	return distinct.sort((a, b) => {
		if (a === EMPTY || b === EMPTY) return a === EMPTY ? -1 : 1;
		return numeric ? Number(a) - Number(b) : a.localeCompare(b);
	});
}

/** Whether the filter does anything (an empty one is the same as none). */
export function isActive(filter: ColumnFilter | undefined): filter is ColumnFilter {
	if (!filter) return false;
	switch (filter.kind) {
		case 'text':
			return filter.text.trim() !== '';
		case 'pick':
			return filter.values.length > 0;
		case 'range':
			return filter.min !== undefined || filter.max !== undefined;
	}
}

export function matchesFilter(value: FilterValue, filter: ColumnFilter): boolean {
	switch (filter.kind) {
		case 'text': {
			const term = filter.text.trim().toLocaleLowerCase();
			return items(value).some((item) => item.toLocaleLowerCase().includes(term));
		}
		case 'pick':
			return items(value).some((item) => filter.values.includes(item));
		case 'range': {
			if (typeof value !== 'number') return false;
			return (
				(filter.min === undefined || value >= filter.min) &&
				(filter.max === undefined || value <= filter.max)
			);
		}
	}
}

/** The rows every active filter keeps. */
export function applyFilters<T>(
	rows: readonly T[],
	filters: Readonly<Record<string, ColumnFilter | undefined>>,
	valueOf: (row: T, column: string) => FilterValue
): readonly T[] {
	const active = Object.entries(filters).filter(([, f]) => isActive(f)) as [string, ColumnFilter][];
	if (!active.length) return rows;
	return rows.filter((row) =>
		active.every(([column, f]) => matchesFilter(valueOf(row, column), f))
	);
}

/** A typed number, or none for an empty or unreadable field. */
export function readBound(text: string): number | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	const number = Number(trimmed);
	return Number.isFinite(number) ? number : undefined;
}
