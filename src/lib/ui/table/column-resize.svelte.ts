/**
 * Dragging a table column's header edge to resize it, for DataTable: pointer drags (one
 * relayout per frame), a double tap back to the column's own width, and arrow keys on the
 * focused handle. Widths are stored in --u through TableWidths.
 */
import type { TableWidths } from '#lib/ui/table/column-widths.svelte.ts';
import { KEY_STEP, MIN_WIDTH, clampWidth } from '#lib/ui/table/column-widths.ts';

interface ResizeColumn<K extends string> {
	id: K;
	/** The narrowest it can be dragged, in --u (default MIN_WIDTH). */
	minWidth?: number;
}

interface ResizeSource<K extends string> {
	/** The table's stored widths, or undefined when its columns don't resize. */
	widths(): TableWidths | undefined;
	/** The header padding the column's handles take, as a CSS length (see DataTable's `room`). */
	handleRoom(column: K): string | undefined;
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

const rtl = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl';

export const minWidthOf = (column: ResizeColumn<string>) => column.minWidth ?? MIN_WIDTH;

export class ColumnResize<K extends string> {
	/** The column being dragged now. */
	resizing = $state<K>();
	#source: ResizeSource<K>;
	#drag:
		| { pointer: number; startX: number; start: number; unit: number; sign: number; moved: boolean }
		| undefined;
	#pending: number | undefined;
	#frame = 0;
	#lastTap: { column: K; time: number } | undefined;

	constructor(source: ResizeSource<K>) {
		this.#source = source;
	}

	/** The column's width now, in --u: its dragged width, else what its header measures. */
	#widthNow(column: ResizeColumn<K>, handle: HTMLElement): { width: number; unit: number } {
		const th = handle.closest('th') as HTMLElement;
		const unit = px('var(--u)', th) || 16;
		// The handle's room is added on top of the stored width (columnTrack).
		const handles = px(`calc(${this.#source.handleRoom(column.id) ?? '0px'})`, th);
		const measured = (th.getBoundingClientRect().width - handles) / unit;
		return { width: this.#source.widths()?.current[column.id] ?? measured, unit };
	}

	start(column: ResizeColumn<K>, event: PointerEvent): void {
		if (!this.#source.widths() || event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement;
		const { width, unit } = this.#widthNow(column, handle);
		this.#drag = {
			pointer: event.pointerId,
			startX: event.clientX,
			start: width,
			unit,
			sign: rtl(handle) ? -1 : 1,
			moved: false
		};
		this.resizing = column.id;
		handle.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	move(column: ResizeColumn<K>, event: PointerEvent): void {
		const drag = this.#drag;
		if (!drag || drag.pointer !== event.pointerId) return;
		const dx = (event.clientX - drag.startX) * drag.sign;
		// A few pixels of wobble is still a tap (a double tap resets).
		if (!drag.moved && Math.abs(dx) < drag.unit / 4) return;
		drag.moved = true;
		this.#pending = clampWidth(drag.start + dx / drag.unit, minWidthOf(column));
		// One relayout per frame however fast the pointer moves.
		this.#frame ||= requestAnimationFrame(() => {
			this.#frame = 0;
			if (this.#pending !== undefined) this.#source.widths()?.set(column.id, this.#pending, false);
		});
	}

	end(column: ResizeColumn<K>, event: PointerEvent): void {
		const drag = this.#drag;
		if (!drag || drag.pointer !== event.pointerId) return;
		const widths = this.#source.widths();
		this.#drag = undefined;
		this.resizing = undefined;
		if (drag.moved) {
			cancelAnimationFrame(this.#frame);
			this.#frame = 0;
			if (this.#pending !== undefined) widths?.set(column.id, this.#pending);
			this.#pending = undefined;
			this.#lastTap = undefined;
			return;
		}
		if (event.type !== 'pointerup') return;
		// Double tap or double click: back to the column's own width.
		if (this.#lastTap?.column === column.id && event.timeStamp - this.#lastTap.time < 400) {
			widths?.reset(column.id);
			this.#lastTap = undefined;
		} else {
			this.#lastTap = { column: column.id, time: event.timeStamp };
		}
	}

	key(column: ResizeColumn<K>, event: KeyboardEvent): void {
		const handle = event.currentTarget as HTMLElement;
		const widths = this.#source.widths();
		if (event.key === 'Enter') {
			widths?.reset(column.id);
			event.preventDefault();
			return;
		}
		const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
		if (!direction) return;
		event.preventDefault();
		const { width } = this.#widthNow(column, handle);
		const step = direction * (rtl(handle) ? -1 : 1) * KEY_STEP * (event.shiftKey ? 4 : 1);
		widths?.set(column.id, clampWidth(width + step, minWidthOf(column)));
	}
}
