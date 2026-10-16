/**
 * A handwriting scratch pad, kept as vector strokes so it redraws sharply at any size.
 *
 * Coordinates are fractions of the pad's width (x 0-1, y 0-PAD_ASPECT), so a drawing made on
 * a phone looks the same on a tablet or after rotating. Colours are names the UI resolves
 * through the theme, so ink stays readable in light and dark themes.
 */

export const SCRATCH_SCHEMA_VERSION = 1;

/** The pad's height as a multiple of its width: a portrait page. */
export const PAD_ASPECT = 4 / 3;

export const SCRATCH_COLOURS = ['ink', 'good', 'evil', 'highlight'] as const;
export type ScratchColour = (typeof SCRATCH_COLOURS)[number];

export type ScratchTool = 'pen' | 'eraser';

/** The pen's width at the middle pressure (0.5) and the eraser's, as fractions of the width. */
const PEN_WIDTH = 0.008;
const ERASER_WIDTH = 0.05;

/** Points closer than this to the last one (a fraction of the width) are dropped. */
export const MIN_POINT_DISTANCE = 0.0015;

export interface ScratchStroke {
	tool: ScratchTool;
	colour: ScratchColour;
	/** Flat x, y, pressure triples; pressure is 0-1 (0.5 when the input has none). */
	points: number[];
}

export interface ScratchPad {
	schemaVersion: typeof SCRATCH_SCHEMA_VERSION;
	strokes: ScratchStroke[];
}

export function emptyPad(): ScratchPad {
	return { schemaVersion: SCRATCH_SCHEMA_VERSION, strokes: [] };
}

/** Width of a stroke at one point, as a fraction of the pad's width. */
export function strokeWidth(stroke: Pick<ScratchStroke, 'tool'>, pressure: number) {
	if (stroke.tool === 'eraser') return ERASER_WIDTH;
	// Half pressure draws the base width; a light touch thins it, a firm one thickens it.
	const p = Math.min(1, Math.max(0, pressure));
	return PEN_WIDTH * (0.4 + 1.2 * p);
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Appends a point unless it is too close to the previous one (keeps saved pads small and
 * strokes smooth). Returns true when the point was added.
 */
export function addPoint(points: number[], x: number, y: number, pressure: number): boolean {
	const n = points.length;
	if (n >= 3) {
		const dx = x - points[n - 3];
		const dy = y - points[n - 2];
		if (dx * dx + dy * dy < MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) return false;
	}
	points.push(
		round(Math.min(1, Math.max(0, x))),
		round(Math.min(PAD_ASPECT, Math.max(0, y))),
		round(Math.min(1, Math.max(0, pressure)))
	);
	return true;
}

/** The strokes on the pad plus the ones undone, which Redo brings back. */
export interface ScratchHistory {
	strokes: readonly ScratchStroke[];
	undone: readonly ScratchStroke[];
}

export function commitStroke(history: ScratchHistory, stroke: ScratchStroke): ScratchHistory {
	if (!stroke.points.length) return history;
	return { strokes: [...history.strokes, stroke], undone: [] };
}

export function undo(history: ScratchHistory): ScratchHistory {
	const last = history.strokes.at(-1);
	if (!last) return history;
	return { strokes: history.strokes.slice(0, -1), undone: [...history.undone, last] };
}

export function redo(history: ScratchHistory): ScratchHistory {
	const next = history.undone.at(-1);
	if (!next) return history;
	return { strokes: [...history.strokes, next], undone: history.undone.slice(0, -1) };
}

/** True when the pad shows nothing: no strokes, or only eraser strokes. */
export function isBlank(strokes: readonly ScratchStroke[]): boolean {
	return !strokes.some((s) => s.tool === 'pen');
}

function isStroke(value: unknown): value is ScratchStroke {
	if (!value || typeof value !== 'object') return false;
	const s = value as Record<string, unknown>;
	return (
		(s.tool === 'pen' || s.tool === 'eraser') &&
		(SCRATCH_COLOURS as readonly unknown[]).includes(s.colour) &&
		Array.isArray(s.points) &&
		s.points.length % 3 === 0 &&
		s.points.every((n) => typeof n === 'number' && Number.isFinite(n))
	);
}

/**
 * Reads a saved pad from any build. A newer build can open a pad saved by an older one, so
 * each schema version upgrades here; unreadable strokes are dropped rather than failing.
 */
export function migratePad(raw: unknown): ScratchPad | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const record = raw as Record<string, unknown>;
	if (record.schemaVersion !== SCRATCH_SCHEMA_VERSION || !Array.isArray(record.strokes))
		return undefined;
	return {
		schemaVersion: SCRATCH_SCHEMA_VERSION,
		strokes: record.strokes.filter(isStroke).map((s) => ({ ...s, points: [...s.points] }))
	};
}
