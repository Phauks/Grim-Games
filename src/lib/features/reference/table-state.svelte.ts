/**
 * The Character reference table's sort and filters, remembered on this device only (like
 * the Cards/Table choice). Storage can be missing or throw; then nothing is remembered.
 */
import {
	parseTableState,
	type TableFilters,
	type TableSort,
	type TableState
} from '#lib/core/rules/reference-table.ts';

const KEY = 'grim-games:reference-table';

function read(): TableState {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		return parseTableState(raw ? JSON.parse(raw) : undefined);
	} catch {
		return { filters: {} };
	}
}

class ReferenceTableState {
	#state = $state<TableState>(read());

	get current(): TableState {
		return this.#state;
	}

	set sort(sort: TableSort | undefined) {
		this.#save({ ...(sort ? { sort } : {}), filters: this.#state.filters });
	}

	setFilter<K extends keyof TableFilters>(key: K, value: TableFilters[K] | undefined): void {
		const filters = { ...this.#state.filters };
		if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
			delete filters[key];
		else filters[key] = value;
		this.#save({ ...this.#state, filters });
	}

	clearFilters(): void {
		this.#save({ ...this.#state, filters: {} });
	}

	#save(state: TableState): void {
		this.#state = state;
		try {
			globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
		} catch {
			// Not remembered; the choice still applies until the page is closed.
		}
	}
}

export const referenceTable = new ReferenceTableState();
