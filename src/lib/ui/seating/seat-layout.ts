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
const MAX_GAP = 3;

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

/** Steps used to measure the ring's length. */
const RING_STEPS = 720;

/**
 * The ring's angle (0 at the top, clockwise, in radians) for each share of the way round,
 * measured on screen: places an equal distance apart along the ring, so an oval's gaps look
 * the same all round (Trevor, 2026-10-17). Equal angles would bunch seats at the long ends.
 */
function ringAngles(rx: number, ry: number, board: BoardSize): (share: number) => number {
	const a = (rx / 100) * board.width;
	const b = (ry / 100) * board.height;
	if (!(a > 0 && b > 0) || Math.abs(a - b) < 0.5) return (share) => share * 2 * Math.PI;
	// Cumulative length at each step, from the top going clockwise.
	const length = [0];
	for (let i = 1; i <= RING_STEPS; i++) {
		const t0 = ((i - 1) / RING_STEPS) * 2 * Math.PI;
		const t1 = (i / RING_STEPS) * 2 * Math.PI;
		const dx = a * (Math.sin(t1) - Math.sin(t0));
		const dy = b * (Math.cos(t0) - Math.cos(t1));
		length.push(length[i - 1] + Math.hypot(dx, dy));
	}
	const total = length[RING_STEPS];
	return (share) => {
		const want = (((share % 1) + 1) % 1) * total;
		let low = 0;
		let high = RING_STEPS;
		while (high - low > 1) {
			const mid = (low + high) >> 1;
			if (length[mid] <= want) low = mid;
			else high = mid;
		}
		const part = (want - length[low]) / (length[high] - length[low] || 1);
		return ((low + part) / RING_STEPS) * 2 * Math.PI;
	};
}

/** The ring's radii, as % of the board's width and height. */
function ringRadii(shape: SeatShape, board: BoardSize): { rx: number; ry: number } {
	if (shape === 'circle' && board.width > 0 && board.height > 0) {
		const radius = RING * Math.min(board.width, board.height);
		return { rx: (radius / board.width) * 100, ry: (radius / board.height) * 100 };
	}
	return { rx: RING * 100, ry: RING * 100 };
}

/** A board's width ÷ height, rounded so a resize by a pixel or two changes nothing. */
export function boardAspect(board: BoardSize): number | undefined {
	if (!(board.width > 0 && board.height > 0)) return undefined;
	return Math.round((board.width / board.height) * 100) / 100;
}

/** Reads a shared board shape (width ÷ height), or nothing when it isn't a sensible one. */
export function parseAspect(value: unknown): number | undefined {
	return isNumber(value) && value >= 0.2 && value <= 5 ? value : undefined;
}

/**
 * Where each seat is drawn, in seating order. `spacedFor` is the shape (width ÷ height) of
 * the board whose clock positions to keep: the Storyteller's, on a player's screen (Trevor,
 * 2026-10-27), so seat 3 sits at the same place round the ring on every device while the
 * ring still fills this one. Left out, seats are spaced for this board.
 */
export function seatPoints(
	seatIds: readonly string[],
	layout: SeatLayout,
	board: BoardSize,
	spacedFor?: number
): SeatPoint[] {
	const starts = ringSlots(seatIds, layout);
	const total = Math.max(starts[seatIds.length], 1);
	const { rx, ry } = ringRadii(layout.shape, board);
	// In pixels on a notional board 1000 high, as ringAngles treats a ring within half a
	// pixel of round as a circle.
	const spacing = spacedFor ? { width: spacedFor * 1000, height: 1000 } : board;
	const spaced = spacedFor ? ringRadii(layout.shape, spacing) : { rx, ry };
	const angleAt = ringAngles(spaced.rx, spaced.ry, spacing);
	// Place 0 at the top, clockwise.
	return seatIds.map((id, i) => {
		if (layout.placed[id]) return layout.placed[id];
		const t = angleAt(starts[i] / total);
		return { x: 50 + rx * Math.sin(t), y: 50 - ry * Math.cos(t) };
	});
}

/** The largest box of `aspect` (width ÷ height) that fits on `board`, centred on it. */
export function fitAspect(board: BoardSize, aspect: number): BoardSize {
	if (!(board.width > 0 && board.height > 0 && aspect > 0)) return board;
	const width = Math.min(board.width, board.height * aspect);
	return { width, height: width / aspect };
}

/** Points in % of a box centred on `board`, in % of the board itself. */
export function centredIn(
	points: readonly SeatPoint[],
	box: BoardSize,
	board: BoardSize
): SeatPoint[] {
	if (!(board.width > 0 && board.height > 0)) return [...points];
	const left = (board.width - box.width) / 2;
	const top = (board.height - box.height) / 2;
	return points.map((p) => ({
		x: ((left + (p.x / 100) * box.width) / board.width) * 100,
		y: ((top + (p.y / 100) * box.height) / board.height) * 100
	}));
}

/**
 * Where a shared grim (a player's Grim tab, Public Town) draws its seats, and their size
 * (Trevor, 2026-10-27): at the places round the ring of the Storyteller's board, whose shape
 * is `aspect`, filling this board, or with `fit` in a box of the board's own shape, centred.
 * Tokens follow the Token size setting; each seat keeps `unit` px clear of the edge, as on
 * the board.
 */
export function sharedSeats(
	seats: readonly { seatId: string }[],
	layout: SeatLayout,
	board: BoardSize,
	aspect: number | undefined,
	fit: boolean,
	preferences: { tokenAppearance: { tokenScale: number } },
	unit = 16
): { size: number; points: SeatPoint[] } {
	const seatIds = seats.map((s) => s.seatId);
	const scale = preferences.tokenAppearance.tokenScale;
	const box = aspect && fit ? fitAspect(board, aspect) : board;
	const size = seatTokenSize(seatIds, layout, box, scale);
	const placed = keepInside(seatPoints(seatIds, layout, box, aspect), box, size / 2 + unit);
	return { size, points: centredIn(placed, box, board) };
}

/**
 * Points pulled in so that something `margin` px from its centre to its edge stays on the
 * board: on a narrow phone the ring would otherwise put tokens past the screen edge.
 */
export function keepInside(
	points: readonly SeatPoint[],
	board: BoardSize,
	margin: number
): SeatPoint[] {
	const clamp = (v: number, size: number) => {
		if (size <= 0) return v;
		const m = Math.min(50, (margin / size) * 100);
		return Math.min(100 - m, Math.max(m, v));
	};
	return points.map((p) => ({ x: clamp(p.x, board.width), y: clamp(p.y, board.height) }));
}

/**
 * Brings the ring's top down just far enough that no seat on it sits under `corner`, a box
 * in the board's top right (the day timer and the buttons beside it), so every seat stays
 * tappable. The ring's bottom stays put, so neighbours keep their order and spacing; seats
 * placed by hand (`onRing` false) stay where they were put. `radius` is a token's half-width
 * plus the margin to keep, in pixels.
 */
export function clearOfCorner(
	points: readonly SeatPoint[],
	onRing: readonly boolean[],
	/**
	 * Every seat's place on the ring, as if none were placed by hand, so moving a seat off
	 * the ring never moves the rest.
	 */
	ring: readonly SeatPoint[],
	board: BoardSize,
	corner: { w: number; h: number },
	radius: number
): SeatPoint[] {
	const { width, height } = board;
	if (width <= 0 || height <= 0 || corner.w <= 0 || corner.h <= 0) return [...points];
	const left = width - corner.w;
	let top = 0;
	ring.forEach((p) => {
		const x = (p.x / 100) * width;
		const y = (p.y / 100) * height;
		if (x + radius <= left || y - radius >= corner.h) return;
		// With the ring squashed from `top` down, this seat's y is top + y(1 - top/height).
		top = Math.max(top, (corner.h + radius - y) / (1 - y / height));
	});
	// Never more than a quarter of the board: past that the corner is better overlapping.
	const t = (Math.min(top, height / 4) / height) * 100;
	if (t <= 0) return [...points];
	return points.map((p, i) => (onRing[i] ? { x: p.x, y: t + p.y * (1 - t / 100) } : p));
}

/** A token size in pixels that keeps neighbours on the ring from overlapping. */
export function seatTokenSize(
	seatIds: readonly string[],
	layout: SeatLayout,
	board: BoardSize,
	/** The user's token size setting: grows or shrinks tokens, but never past the spacing. */
	scale = 1
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
	const fit = Math.max(44, Math.min(96, bySpacing, byBoard));
	return Math.round(Math.max(44, Math.min(fit * scale, Math.max(fit, bySpacing))));
}

/**
 * Points from a seat towards the middle of the board, at each distance (px) from the seat's
 * centre: where its reminder tokens go, as in front of a token in the physical grimoire.
 * A seat at the very middle sends them downwards.
 */
export function towardsMiddle(
	seat: SeatPoint,
	board: BoardSize,
	distances: readonly number[]
): SeatPoint[] {
	const { width, height } = board;
	if (width <= 0 || height <= 0) return distances.map(() => seat);
	const dx = ((50 - seat.x) / 100) * width;
	const dy = ((50 - seat.y) / 100) * height;
	const length = Math.hypot(dx, dy);
	const [ux, uy] = length < 1 ? [0, 1] : [dx / length, dy / length];
	return distances.map((d) => ({
		x: seat.x + ((ux * d) / width) * 100,
		y: seat.y + ((uy * d) / height) * 100
	}));
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

/**
 * Two players swap places (the Matron): each takes the other's hand-placed spot and gap, as
 * the places stay where they are and only who sits in them changes.
 */
export function swapPlaces(layout: SeatLayout, a: string, b: string): SeatLayout {
	const swap = <T>(entries: Readonly<Record<string, T>>) => {
		const out = { ...entries };
		delete out[a];
		delete out[b];
		if (entries[b] !== undefined) out[a] = entries[b];
		if (entries[a] !== undefined) out[b] = entries[a];
		return out;
	};
	return { ...layout, placed: swap(layout.placed), gaps: swap(layout.gaps) };
}

/** Puts a hand-placed seat back on the ring. */
export function withoutPlaced(layout: SeatLayout, seatId: string): SeatLayout {
	const placed = { ...layout.placed };
	delete placed[seatId];
	return { ...layout, placed };
}

/**
 * Whether `after` is `before` turned round the table (everyone moved the same number of
 * places), and not the same order.
 */
export function isRotation(before: readonly string[], after: readonly string[]): boolean {
	const n = before.length;
	if (n !== after.length || n < 2) return false;
	const shift = after.indexOf(before[0]);
	if (shift <= 0) return false;
	return before.every((id, i) => after[(i + shift) % n] === id);
}

/**
 * After the players rotate round the table, the places stay where they were: whoever now
 * sits in a hand-placed spot (or before a gap) takes that spot. Positions belong to the
 * place in the seating order, not to the player.
 */
export function followSeating(
	layout: SeatLayout,
	before: readonly string[],
	after: readonly string[]
): SeatLayout {
	if (before.length !== after.length) return layout;
	const placed: Record<string, SeatPoint> = {};
	const gaps: Record<string, number> = {};
	before.forEach((id, i) => {
		if (layout.placed[id]) placed[after[i]] = layout.placed[id];
		if (layout.gaps[id]) gaps[after[i]] = layout.gaps[id];
	});
	return { ...layout, placed, gaps };
}

/**
 * The seating order read from where seats are drawn (Trevor, 2026-10-16): clockwise around
 * `centre`, so Spread evenly keeps a seat dragged to a new place there instead of putting it
 * back. Of the ways round the circle, the one that moves seats least onto `slots` (where seat
 * 1, 2, … will be drawn once spread) wins. Points are in pixels (y down), one per seat.
 */
export function orderAround(
	seating: readonly string[],
	points: readonly { x: number; y: number }[],
	centre: { x: number; y: number },
	slots: readonly { x: number; y: number }[] = points
): string[] {
	const n = seating.length;
	if (n === 0) return [];
	const angle = (p: { x: number; y: number }) => Math.atan2(p.y - centre.y, p.x - centre.x);
	const around = seating
		.map((id, i) => ({ id, i, a: angle(points[i]) }))
		.sort((p, q) => p.a - q.a || p.i - q.i);
	const cost = (start: number) =>
		around.reduce((sum, _, k) => {
			const p = points[around[(start + k) % n].i];
			return sum + (p.x - slots[k].x) ** 2 + (p.y - slots[k].y) ** 2;
		}, 0);
	let best = 0;
	for (let start = 1; start < n; start++) if (cost(start) < cost(best)) best = start;
	return around.map((_, k) => around[(best + k) % n].id);
}

/** Everyone back on the ring, evenly spaced in seating order: no gaps, nobody hand-placed. */
export function spreadEvenly(layout: SeatLayout): SeatLayout {
	return { ...layout, gaps: {}, placed: {} };
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
