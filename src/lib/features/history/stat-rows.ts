import type { DataSort } from '#lib/ui/table/DataTable.svelte';

type Value = number | string | undefined;

/**
 * Sorts stat rows by one column. Rows with no value (no win rate yet) go last either way;
 * ties keep their order, so most recently played stays first among equals.
 */
export function sortRows<T, K extends string>(
	rows: readonly T[],
	sort: DataSort<K> | undefined,
	value: (row: T, column: K) => Value
): T[] {
	if (!sort) return [...rows];
	const sign = sort.direction === 'ascending' ? 1 : -1;
	return [...rows].sort((a, b) => {
		const x = value(a, sort.column);
		const y = value(b, sort.column);
		if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
		if (typeof x === 'string' || typeof y === 'string')
			return sign * String(x).localeCompare(String(y));
		return sign * (x - y);
	});
}

/**
 * The sort after tapping a column's header: names start A to Z, counts start highest first,
 * and a second tap reverses it.
 */
export function nextSort<K extends string>(
	current: DataSort<K> | undefined,
	column: K,
	textColumns: readonly K[]
): DataSort<K> {
	const first = textColumns.includes(column) ? 'ascending' : 'descending';
	if (current?.column !== column) return { column, direction: first };
	return {
		column,
		direction: current.direction === 'ascending' ? 'descending' : 'ascending'
	};
}

/** Whether a name contains the filter text, ignoring case; an empty filter matches all. */
export function matchesText(name: string | undefined, filter: string): boolean {
	const wanted = filter.trim().toLocaleLowerCase();
	return wanted === '' || (name ?? '').toLocaleLowerCase().includes(wanted);
}
