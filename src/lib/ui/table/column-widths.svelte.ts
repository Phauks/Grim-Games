/**
 * Dragged column widths and hidden columns, one set per table, remembered on this device only (like the
 * Reference table's sort). Storage can be missing or throw; then widths last until reload.
 */
import { parseHidden, parseWidths, type ColumnWidths } from '#lib/ui/table/column-widths.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';

const PREFIX = 'grim-games:table-widths:';

function read(table: string): ColumnWidths {
	return parseWidths(readStored(PREFIX + table));
}

export class TableWidths {
	readonly #table: string;
	#widths = $state<ColumnWidths>({});

	constructor(table: string) {
		this.#table = table;
		this.#widths = read(table);
	}

	get current(): ColumnWidths {
		return this.#widths;
	}

	/** Shows a width now; `save` also remembers it (once a drag ends, not on every move). */
	set(column: string, width: number, save = true): void {
		this.#widths = { ...this.#widths, [column]: width };
		if (save) this.save();
	}

	reset(column: string): void {
		const widths = { ...this.#widths };
		delete widths[column];
		this.#widths = widths;
		this.save();
	}

	save(): void {
		// If not remembered, the widths still apply until the page is closed.
		const empty = Object.keys(this.#widths).length === 0;
		writeStored(PREFIX + this.#table, empty ? undefined : this.#widths);
	}
}

const HIDDEN_PREFIX = 'grim-games:table-hidden:';

/** Columns a person hid from one table, remembered on this device like its widths. */
export class HiddenColumns {
	readonly #table: string;
	#hidden = $state<readonly string[]>([]);

	constructor(table: string) {
		this.#table = table;
		this.#hidden = parseHidden(readStored(HIDDEN_PREFIX + table));
	}

	has(column: string): boolean {
		return this.#hidden.includes(column);
	}

	get count(): number {
		return this.#hidden.length;
	}

	set(column: string, hidden: boolean): void {
		const rest = this.#hidden.filter((id) => id !== column);
		this.#hidden = hidden ? [...rest, column] : rest;
		writeStored(HIDDEN_PREFIX + this.#table, this.#hidden.length ? this.#hidden : undefined);
	}
}
