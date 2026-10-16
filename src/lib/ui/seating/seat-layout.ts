/**
 * Where seats sit on screen. Real tables are rarely exact circles: people leave gaps, sit
 * unevenly, or share a couch. A layout starts from a ring (an oval filling the screen or a
 * true circle), adds empty gaps between neighbours, and lets any seat be placed by hand,
 * which is how seats are pulled into small groups.
 *
 * Seating order (who neighbours whom) is game data and never changes here: a layout only
 * says where each seat is drawn. Pure TypeScript with no game imports, so the Storyteller's
 * grimoire and the player's view share it. Seats are plain string ids.
 */

export type SeatShape = 'oval' | 'circle';

/** A point as percentages of the board's width and height (0 to 100). */
export interface SeatPoint {
	x: number;
	y: number;
}

export interface SeatLayout {
	shape: SeatShape;
	/** Empty places on the ring after a seat (clockwise), by seat id. */
	gaps: Readonly<Record<string, number>>;
	/** Seats placed by hand, by seat id. Other seats stay on the ring. */
	placed: Readonly<Record<string, SeatPoint>>;
}

/** The board's size in pixels, needed to draw a true circle and to size tokens. */
export interface BoardSize {
	width: number;
	height: number;
}

export const DEFAULT_SEAT_LAYOUT: SeatLayout = { shape: 'oval', gaps: {}, placed: {} };

/** The most empty places allowed after one seat. */
export const MAX_GAP = 3;

/** The ring's radius, as a share of the board's width and height (or its shorter side). */
const RING = 0.41;
/** Hand-placed seats keep their centre this far inside the board's edges. */
const EDGE = 6;

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** Rounds to one decimal place, so saved layouts stay small and stable. */
const tidy = (n: number) => Math.round(n * 10) / 10;

/** Ring places in use: one per seat plus the gaps after seats that are still here. */
function ringSlots(seatIds: readonly string[], layout: SeatLayout): number[] {
	const starts: number[] = [];
	let slot = 0;
	for (const id of seatIds) {
		starts.push(slot);
		slot += 1 + (layout.gaps[id] ?? 0);
	}
	starts.push(slot);
	return starts;
}

/** The point at `slot` of `total` places round the ring. Place 0 is at the top, clockwise. */
function ringPoint(slot: number, total: number, shape: SeatShape, board: BoardSize): SeatPoint {
	const angle = (slot / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
	let rx = RING * 100;
	let ry = RING * 100;
	if (shape === 'circle' && board.width > 0 && board.height > 0) {
		const radius = RING * Math.min(board.width, board.height);
		rx = (radius / board.width) * 100;
		ry = (radius / board.height) * 100;
	}
	return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
}

/** Where each seat is drawn, in seating order. */
export function seatPoints(
	seatIds: readonly string[],
	layout: SeatLayout,
	board: BoardSize
): SeatPoint[] {
	const starts = ringSlots(seatIds, layout);
	const total = starts[seatIds.length];
	return seatIds.map(
		(id, i) => layout.placed[id] ?? ringPoint(starts[i], total, layout.shape, board)
	);
}

/**
 * Where to draw the control for the gap after each seat: midway round the ring between it
 * and the next seat, even when either seat was placed by hand. `inset` (0 to 1) pulls the
 * controls towards the middle, so they sit inside the ring rather than over the tokens.
 */
export function gapPoints(
	seatIds: readonly string[],
	layout: SeatLayout,
	board: BoardSize,
	inset = 0
): SeatPoint[] {
	const starts = ringSlots(seatIds, layout);
	const total = starts[seatIds.length];
	const scale = 1 - clamp(inset, 0, 1);
	return seatIds.map((_, i) => {
		const p = ringPoint((starts[i] + starts[i + 1]) / 2, total, layout.shape, board);
		return { x: 50 + (p.x - 50) * scale, y: 50 + (p.y - 50) * scale };
	});
}

/** A token size in pixels that keeps neighbours on the ring from overlapping. */
export function seatTokenSize(
	seatIds: readonly string[],
	layout: SeatLayout,
	board: BoardSize
): number {
	const { width, height } = board;
	if (width <= 0 || height <= 0) return 56;
	const total = ringSlots(seatIds, layout)[seatIds.length];
	let a = RING * width;
	let b = RING * height;
	if (layout.shape === 'circle') a = b = RING * Math.min(width, height);
	// The ellipse's perimeter (Ramanujan), shared between the places on the ring, leaving
	// room for the name under each token.
	const h = ((a - b) / (a + b)) ** 2;
	const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
	const bySpacing = (perimeter / Math.max(total, 1)) * 0.72;
	const byBoard = Math.min(width, height) * 0.2;
	return Math.round(Math.max(44, Math.min(96, bySpacing, byBoard)));
}

export function withShape(layout: SeatLayout, shape: SeatShape): SeatLayout {
	return { ...layout, shape };
}

/** Sets the empty places after a seat, from 0 to `MAX_GAP`. */
export function withGap(layout: SeatLayout, seatId: string, gap: number): SeatLayout {
	const gaps = { ...layout.gaps };
	const n = clamp(Math.round(gap), 0, MAX_GAP);
	if (n === 0) delete gaps[seatId];
	else gaps[seatId] = n;
	return { ...layout, gaps };
}

/** The next gap size when the gap control is tapped: 0, 1, ... `MAX_GAP`, then 0 again. */
export function nextGap(layout: SeatLayout, seatId: string): number {
	return ((layout.gaps[seatId] ?? 0) + 1) % (MAX_GAP + 1);
}

/** Places a seat by hand, kept inside the board. */
export function withPlaced(layout: SeatLayout, seatId: string, point: SeatPoint): SeatLayout {
	return {
		...layout,
		placed: {
			...layout.placed,
			[seatId]: {
				x: tidy(clamp(point.x, EDGE, 100 - EDGE)),
				y: tidy(clamp(point.y, EDGE, 100 - EDGE))
			}
		}
	};
}

/** Puts a hand-placed seat back on the ring. */
export function withoutPlaced(layout: SeatLayout, seatId: string): SeatLayout {
	const placed = { ...layout.placed };
	delete placed[seatId];
	return { ...layout, placed };
}

/** Forgets gaps and placements of seats that are no longer at the table. */
export function pruneLayout(layout: SeatLayout, seatIds: readonly string[]): SeatLayout {
	const here = new Set(seatIds);
	const keep = <T>(record: Readonly<Record<string, T>>) =>
		Object.fromEntries(Object.entries(record).filter(([id]) => here.has(id)));
	return { ...layout, gaps: keep(layout.gaps), placed: keep(layout.placed) };
}

export function isDefaultLayout(layout: SeatLayout): boolean {
	return (
		layout.shape === 'oval' &&
		Object.keys(layout.gaps).length === 0 &&
		Object.keys(layout.placed).length === 0
	);
}

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Reads a saved layout, keeping what is valid and dropping the rest, so a damaged or
 * hand-edited save never stops the board from drawing.
 */
export function parseSeatLayout(value: unknown): SeatLayout {
	if (typeof value !== 'object' || value === null) return DEFAULT_SEAT_LAYOUT;
	const raw = value as Record<string, unknown>;
	let layout: SeatLayout = {
		...DEFAULT_SEAT_LAYOUT,
		shape: raw.shape === 'circle' ? 'circle' : 'oval'
	};
	if (typeof raw.gaps === 'object' && raw.gaps !== null) {
		for (const [id, gap] of Object.entries(raw.gaps)) {
			if (isNumber(gap)) layout = withGap(layout, id, gap);
		}
	}
	if (typeof raw.placed === 'object' && raw.placed !== null) {
		for (const [id, point] of Object.entries(raw.placed)) {
			const p = point as Record<string, unknown> | null;
			if (p && isNumber(p.x) && isNumber(p.y)) layout = withPlaced(layout, id, { x: p.x, y: p.y });
		}
	}
	return layout;
}
