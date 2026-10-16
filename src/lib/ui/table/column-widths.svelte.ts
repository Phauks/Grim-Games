/**
 * Dragged column widths, one set per table, remembered on this device only (like the
 * Reference table's sort). Storage can be missing or throw; then widths last until reload.
 */
import { parseWidths, type ColumnWidths } from '#lib/ui/table/column-widths.ts';

const PREFIX = 'grim-games:table-widths:';

function read(table: string): ColumnWidths {
	try {
		const raw = globalThis.localStorage?.getItem(PREFIX + table);
		return parseWidths(raw ? JSON.parse(raw) : undefined);
	} catch {
		return {};
	}
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
		try {
			if (Object.keys(this.#widths).length === 0)
				globalThis.localStorage?.removeItem(PREFIX + this.#table);
			else globalThis.localStorage?.setItem(PREFIX + this.#table, JSON.stringify(this.#widths));
		} catch {
			// Not remembered; the widths still apply until the page is closed.
		}
	}
}
