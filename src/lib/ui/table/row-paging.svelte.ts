/**
 * Paging for DataTable: building thousands of rows at once took about 4 s on a phone
 * (Bloodstar's 4,682 scripts). A new list starts at one page again; a list that only grew at
 * its end (BotC Scripts' next page) keeps what is drawn, so nothing jumps while scrolling.
 */
import { untrack } from 'svelte';

interface PagingSource<T> {
	rows(): readonly T[];
	key(row: T): string;
	/** Rows per page; undefined draws all. */
	pageSize(): number | undefined;
	/** Rows still to come from elsewhere (a site's next pages). */
	moreRows(): number;
	/** The box a filling table scrolls in, back to its top for a new list. */
	scroller(): HTMLElement | undefined;
	fill(): boolean;
	/** The box rows scroll in, or null for the page. */
	root(): Element | null;
	/** Every row is drawn and the end came near. */
	onend(): void;
}

export class RowPaging<T> {
	#source: PagingSource<T>;
	#limit = $state(Infinity);
	#firstKey: string | undefined;
	/** The rows drawn so far. */
	readonly drawn = $derived.by(() => {
		const rows = this.#source.rows();
		return this.#limit < rows.length ? rows.slice(0, this.#limit) : rows;
	});
	/** Rows not drawn yet, here or still to come: the space kept for them below. */
	readonly undrawn = $derived.by(
		() => this.#source.rows().length - this.drawn.length + Math.max(0, this.#source.moreRows())
	);

	constructor(source: PagingSource<T>) {
		this.#source = source;
		$effect.pre(() => {
			const rows = source.rows();
			const first = rows.length ? source.key(rows[0]) : undefined;
			if (first !== this.#firstKey || untrack(() => this.#limit) === Infinity) {
				const size = source.pageSize();
				this.#limit = size ?? Infinity;
				// A new list starts at its top, or the old scroll position would draw page after page.
				const box = untrack(() => source.scroller());
				if (size && source.fill() && box) box.scrollTop = 0;
			}
			this.#firstKey = first;
		});
	}

	/**
	 * The space kept for undrawn rows came near. The list never ends early, so a scroll in
	 * flight never stops at the end of a page (Trevor, 2026-10-18: Search only went on once he
	 * let go). Enough pages are drawn to reach past the screen, however far it jumped.
	 */
	reachEnd(space: Element): void {
		if (this.drawn.length >= this.#source.rows().length) {
			this.#source.onend();
			return;
		}
		const size = this.#source.pageSize() ?? Infinity;
		const root = this.#source.root();
		const box = space.getBoundingClientRect();
		const view = root ? root.getBoundingClientRect() : { top: 0, bottom: innerHeight };
		const rowHeight = box.height / Math.max(1, this.undrawn);
		const past = view.bottom + (view.bottom - view.top) - box.top;
		const pages = Math.max(1, Math.ceil(past / rowHeight / size));
		this.#limit += pages * size;
	}
}
