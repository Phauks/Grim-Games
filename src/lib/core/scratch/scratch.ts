/**
 * A handwriting scratch pad, kept as vector strokes so it redraws sharply at any size.
 *
 * Coordinates are in pad units: 1 is the width of the pad the drawing started on, so a drawing
 * made on a phone keeps its shape on a tablet or after rotating. The pad fills whatever space
 * it has; `fitScale` shrinks a drawing that came from a taller or wider pad until it all shows. Colours are names the UI resolves
 * through the theme, so ink stays readable in light and dark themes.
 */

/**
 * v2 (2026-10-16): each stroke carries its own size. v3 (2026-10-17): a player keeps several
 * pads, each with a title, a paper colour, a lock and a hide switch.
 */
export const SCRATCH_SCHEMA_VERSION = 3;

/** How far a point can sit from the pad's corner, in pad units (a guard on saved data). */
export const MAX_EXTENT = 8;

export const SCRATCH_COLOURS = ['ink', 'good', 'evil', 'highlight'] as const;
export type ScratchColour = (typeof SCRATCH_COLOURS)[number];

export type ScratchTool = 'pen' | 'eraser';

/** Paper colours; the UI maps each to a page colour and inks that read on it. */
export const SCRATCH_PAPERS = ['leather', 'parchment', 'white'] as const;
export type ScratchPaper = (typeof SCRATCH_PAPERS)[number];

/**
 * Sizes are steps on a slider (1 to SIZE_STEPS); each step widens the pen or eraser by a fixed
 * fraction of the pad's width. The pen's size is its width at the middle pressure (0.5).
 */
export const SIZE_STEPS = 20;
const SIZE_UNIT: Record<ScratchTool, number> = { pen: 0.002, eraser: 0.0075 };
export const DEFAULT_SIZE: Record<ScratchTool, number> = { pen: 4, eraser: 7 };

/** A whole slider step from 1 to SIZE_STEPS. */
export function clampStep(step: number): number {
	return Math.min(SIZE_STEPS, Math.max(1, Math.round(step)));
}

/** Base width for a tool at a slider step, as a fraction of the pad's width. */
export function sizeWidth(tool: ScratchTool, step: number): number {
	return round(clampStep(step) * SIZE_UNIT[tool]);
}

/** Remembered slider steps; anything missing or invalid falls back to the default. */
export function parseSizes(raw: unknown): Record<ScratchTool, number> {
	const sizes = { ...DEFAULT_SIZE };
	if (typeof raw !== 'object' || raw === null) return sizes;
	for (const tool of ['pen', 'eraser'] as const) {
		const step = (raw as Record<string, unknown>)[tool];
		if (typeof step === 'number' && Number.isFinite(step)) sizes[tool] = clampStep(step);
	}
	return sizes;
}

/** v1 strokes had one fixed width per tool. */
const V1_WIDTH: Record<ScratchTool, number> = { pen: 0.008, eraser: 0.05 };

/** Points closer than this to the last one (a fraction of the width) are dropped. */
export const MIN_POINT_DISTANCE = 0.0015;

export interface ScratchStroke {
	tool: ScratchTool;
	colour: ScratchColour;
	/** Base width, a fraction of the pad's width (see `sizeWidth`). */
	size: number;
	/** Flat x, y, pressure triples; pressure is 0-1 (0.5 when the input has none). */
	points: number[];
}

export interface ScratchPad {
	schemaVersion: typeof SCRATCH_SCHEMA_VERSION;
	strokes: ScratchStroke[];
	/** Empty until the player names it. */
	title: string;
	paper: ScratchPaper;
	/** Locked pads can be looked at but not drawn on. */
	locked: boolean;
	/** Hidden pads show no drawing in the list of pads. */
	hidden: boolean;
	/** Orders the list of pads, oldest first. */
	createdAt: number;
}

export function emptyPad(createdAt = 0): ScratchPad {
	return {
		schemaVersion: SCRATCH_SCHEMA_VERSION,
		strokes: [],
		title: '',
		paper: 'leather',
		locked: false,
		hidden: false,
		createdAt
	};
}

/** Width of a stroke at one point, as a fraction of the pad's width. */
export function strokeWidth(stroke: Pick<ScratchStroke, 'tool' | 'size'>, pressure: number) {
	if (stroke.tool === 'eraser') return stroke.size;
	// Half pressure draws the base width; a light touch thins it, a firm one thickens it.
	const p = Math.min(1, Math.max(0, pressure));
	return stroke.size * (0.4 + 1.2 * p);
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
		round(Math.min(MAX_EXTENT, Math.max(0, x))),
		round(Math.min(MAX_EXTENT, Math.max(0, y))),
		round(Math.min(1, Math.max(0, pressure)))
	);
	return true;
}

/**
 * Pixels per pad unit for a pad `width` x `height` pixels: the full width, unless the
 * drawing reaches further right or lower than that shows, then small enough to show it all.
 */
export function fitScale(strokes: readonly ScratchStroke[], width: number, height: number) {
	let right = 1;
	let bottom = 0;
	for (const stroke of strokes) {
		if (stroke.tool !== 'pen') continue;
		const edge = stroke.size;
		for (let i = 0; i < stroke.points.length; i += 3) {
			right = Math.max(right, stroke.points[i] + edge);
			bottom = Math.max(bottom, stroke.points[i + 1] + edge);
		}
	}
	return Math.min(width / right, bottom > 0 ? height / bottom : Infinity);
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
		typeof s.size === 'number' &&
		Number.isFinite(s.size) &&
		s.size > 0 &&
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
	if (!Array.isArray(record.strokes)) return undefined;
	let strokes: unknown[] = record.strokes;
	switch (record.schemaVersion) {
		case 1:
			// v1 -> v2: strokes gain the fixed width v1 drew them at.
			strokes = strokes.map((s) =>
				s && typeof s === 'object' && 'tool' in s
					? { ...s, size: V1_WIDTH[(s as { tool: ScratchTool }).tool] ?? V1_WIDTH.pen }
					: s
			);
			break;
		// v2 -> v3 changes no strokes; the pad's new fields take their defaults below.
		case 2:
		case SCRATCH_SCHEMA_VERSION:
			break;
		default:
			return undefined;
	}
	const fallback = emptyPad();
	const paper = (SCRATCH_PAPERS as readonly unknown[]).includes(record.paper)
		? (record.paper as ScratchPaper)
		: fallback.paper;
	const createdAt = [record.createdAt, record.updatedAt].find(
		(n): n is number => typeof n === 'number' && Number.isFinite(n)
	);
	return {
		schemaVersion: SCRATCH_SCHEMA_VERSION,
		strokes: strokes.filter(isStroke).map((s) => ({ ...s, points: [...s.points] })),
		title: typeof record.title === 'string' ? record.title : fallback.title,
		paper,
		locked: record.locked === true,
		hidden: record.hidden === true,
		createdAt: createdAt ?? fallback.createdAt
	};
}
