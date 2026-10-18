/**
 * Column widths a person dragged, in --u (so they scale with the app, never pixels).
 * Pure helpers; the remembered state lives in column-widths.svelte.ts.
 */

export type ColumnWidths = Readonly<Record<string, number>>;

/** Narrowest a column can get: room for its funnel or a short label. */
export const MIN_WIDTH = 4;
/** Widest: about a phone screen, so one column can't swallow the table. */
export const MAX_WIDTH = 60;
/** One arrow-key press. */
export const KEY_STEP = 1;

/** Within the column's limits, to a quarter of a unit (stored values stay short). */
export function clampWidth(width: number, min = MIN_WIDTH, max = MAX_WIDTH): number {
	const low = Math.min(min, max);
	return Math.round(Math.min(Math.max(width, low), max) * 4) / 4;
}

/** Saved widths, dropping anything that isn't a sensible number (storage may be stale). */
export function parseWidths(value: unknown): ColumnWidths {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const widths: Record<string, number> = {};
	for (const [id, width] of Object.entries(value)) {
		if (typeof width === 'number' && Number.isFinite(width) && width > 0)
			widths[id] = clampWidth(width, 0);
	}
	return widths;
}

/**
 * The grid track for a column: its dragged width if it has one, else its own. `room` (the
 * resize handle's width) is added to fixed widths, so the handle never squeezes the header;
 * flexible tracks (fr, %, minmax) share out the space as they are.
 */
export function columnTrack(dragged: number | undefined, fallback: string, room?: string): string {
	const extra = room ? ` + ${room}` : '';
	if (dragged !== undefined) return `calc(${dragged} * var(--u)${extra})`;
	if (!room || /fr|%|minmax|auto|content/.test(fallback)) return fallback;
	return `calc(${fallback}${extra})`;
}

/** Saved hidden columns: ids only, anything else dropped (storage may be stale). */
export function parseHidden(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((id): id is string => typeof id === 'string' && id !== ''))];
}
