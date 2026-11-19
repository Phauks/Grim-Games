/**
 * Where a seat's reminders sit on the board (Trevor, 2026-11-13 and 14, "Rethink reminder
 * token layout around characters"): all of a seat's reminders sit together as one tight group
 * in one place beside its token, never on it and never on the space round it kept for its
 * controls. The group heads inward, keeps out of the middle of the table and away from other
 * players where it can, and stays as close to its own token as the room allows. Every
 * reminder is shown, so each can be dragged (Trevor, 2026-10-16), at the tap size a finger
 * needs (2026-10-17). Pixels throughout.
 */
import type { Box } from './name-placement.ts';

type Point = { x: number; y: number };

export interface FanInput {
	/** The seat's centre. */
	seat: Point;
	/** The middle of the table the reminders face. */
	middle: Point;
	count: number;
	/** Token and reminder diameters. */
	size: number;
	chip: number;
	/** The seat's name and the marks round its token (avoidBoxes), which no reminder covers. */
	avoid?: readonly Box[];
}

/** Space between reminders in a group, and between a token's edge and a reminder. */
const GAP = 3;
const EDGE = 2;
/** How far out a group may start, from the seat's centre, before it squeezes: token widths. */
const CLOSE = 1.15;
/** How far out it may go when even squeezed it has no room close by. */
const FAR = 3.2;
/** A group's spacing, as shares of a reminder: apart, then overlapping a little, then more. */
const SQUEEZES = [1, 0.72, 0.55];
/** Turns from straight at the middle a group tries first, then when nothing fits (degrees). */
const INWARD = 80;
/** A group with no room close by may turn any way and go this far out (token widths), whole. */
const SPILL_TURN = 180;
const SPILL = 5;
/** A shingle's rows: how far down each row sits (shares of a reminder), and how far across. */
const SHINGLE_ROW = 0.55;
const SHINGLE_SHIFT = 0.5;
const ANYWHERE = 130;
const TURN_STEP = 5;
const OUT_STEP = 3;
/** The middle of the table groups keep out of: a circle this share of the board's shorter side. */
const MIDDLE = 0.22;

function overlaps(a: Box, b: Box): boolean {
	return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

const mean = (points: readonly Point[]): Point => ({
	x: points.reduce((t, p) => t + p.x, 0) / points.length,
	y: points.reduce((t, p) => t + p.y, 0) / points.length
});

/**
 * A tight group of `n` places, packed like a honeycomb and as wide as it is deep: two side by
 * side, three in a triangle, more in rows. `x` runs across, `y` away from the seat, starting
 * at 0 on the side nearest the seat.
 */
function groupShape(n: number, pitch: number): Point[] {
	const grid: Point[] = [];
	for (let row = 0; row <= n; row++)
		for (let col = -n; col <= n; col++)
			grid.push({ x: col * pitch + (row % 2 ? pitch / 2 : 0), y: row * pitch * 0.87 });
	const out: Point[] = [{ x: 0, y: 0 }];
	while (out.length < n) {
		const c = mean(out);
		let best: Point | undefined;
		let bestScore = Infinity;
		for (const p of grid) {
			if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1)) continue;
			// Wider before deeper, so the group stays near its seat; the small x term breaks ties.
			const score = Math.abs(p.x - c.x) + 1.4 * Math.abs(p.y - c.y) + 0.01 * p.x;
			if (score < bestScore) [best, bestScore] = [p, score];
		}
		out.push(best!);
	}
	const across = mean(out).x;
	return out.map((p) => ({ x: p.x - across, y: p.y }));
}

/**
 * The shapes a whole group may take where it spills: its usual cluster, then one line across
 * (a row along a gap), then one line deep (a row out along the seat's own line).
 */
function spillShapes(n: number, pitch: number): Point[][] {
	const line = Array.from({ length: n }, (_, j) => (j - (n - 1) / 2) * pitch);
	return [
		groupShape(n, pitch),
		line.map((x) => ({ x, y: 0 })),
		line.map((y, j) => ({ x: 0, y: j * pitch }))
	];
}

/**
 * A staggered shingle of `n` places, upright on the screen: rows of two (three past six), each
 * row a little lower than the last and shifted half a place across, so every label shows below
 * the row in front of it. Upper rows come last, so they are drawn over the rows below.
 */
function shingleShape(n: number, k: number): Point[] {
	const cols = n <= 6 ? 2 : 3;
	const rows = Math.ceil(n / cols);
	const pitch = k + GAP;
	const out: Point[] = [];
	for (let row = rows - 1; row >= 0; row--) {
		const inRow = row === rows - 1 ? n - cols * (rows - 1) : cols;
		const shift = row % 2 ? SHINGLE_SHIFT * pitch : 0;
		for (let col = 0; col < inRow; col++)
			out.push({
				x: (col - (cols - 1) / 2) * pitch + shift,
				y: (row - (rows - 1) / 2) * SHINGLE_ROW * k
			});
	}
	return out;
}

/**
 * Every seat's reminders on the board, kept clear of `blocked` (the corner, the timer) and
 * inside `board`. Seats with the most reminders are placed first, so a big group isn't
 * squeezed out by a small one; no group covers another's. `fits` is false when some group had
 * to squeeze or go further out than close by.
 */
export function fitReminders(
	seats: readonly FanInput[],
	blocked: readonly Box[] = [],
	board?: { width: number; height: number }
): { at: Point[][]; fits: boolean } {
	let fits = true;
	const at: Point[][] = seats.map(() => []);
	const taken: Box[] = [];
	const marks = seats.flatMap((s) => s.avoid ?? []);
	const order = seats.map((_, i) => i).sort((a, b) => seats[b].count - seats[a].count || a - b);
	const middleRadius = board ? MIDDLE * Math.min(board.width, board.height) : 0;

	for (const i of order) {
		const s = seats[i];
		if (s.count <= 0) continue;
		const k = s.chip;
		const inside = (p: Point) =>
			!board ||
			(p.x - k / 2 >= 0 &&
				p.y - k / 2 >= 0 &&
				p.x + k / 2 <= board.width &&
				p.y + k / 2 <= board.height);
		const dx = s.middle.x - s.seat.x;
		const dy = s.middle.y - s.seat.y;
		const facing = Math.hypot(dx, dy) < 1 ? Math.PI / 2 : Math.atan2(dy, dx);
		const nearerOther = (p: Point, own: number) => {
			const mine = Math.hypot(p.x - seats[own].seat.x, p.y - seats[own].seat.y);
			// Only seats with reminders of their own, whose groups it could be taken for.
			return seats.some(
				(o, j) => j !== own && o.count > 0 && Math.hypot(p.x - o.seat.x, p.y - o.seat.y) < mine
			);
		};

		/**
		 * The best place for `shape`: for each turn away from the middle, the nearest distance
		 * where the whole group is clear, scored by how far out it is, how far it turns, how far
		 * it reaches into the middle and how close it comes to other players. `loose`: may sit
		 * nearer another seat (1), or over other groups too (2). `strict`: every reminder, not
		 * just the group's middle, nearer its own seat than any other seat with reminders.
		 * `upright`: the shape keeps to the screen, not turned with the direction it goes out.
		 */
		const place = (
			shape: Point[],
			loose: number,
			turn: number,
			farthest: number,
			strict = false,
			upright = false
		) => {
			// Only what the group could reach is checked, so a crowded board stays quick.
			const extent = Math.max(...shape.map((o) => Math.hypot(o.x, o.y + farthest))) + k;
			const within = (b: Point, r: number) =>
				Math.hypot(b.x - s.seat.x, b.y - s.seat.y) < extent + r;
			const obstacles = [...blocked, ...marks].filter((b) => within(b, b.w + b.h));
			const others = loose < 2 ? taken.filter((b) => within(b, k)) : [];
			const tokens = seats.filter((o) => within(o.seat, o.size));
			// On the board, off every token and the gap beside it, and off every mark and group.
			const clear = (p: Point) => {
				if (!inside(p)) return false;
				for (const o of tokens)
					if (Math.hypot(p.x - o.seat.x, p.y - o.seat.y) < o.size / 2 + k / 2 + EDGE) return false;
				const b = { ...p, w: k, h: k };
				return !obstacles.some((o) => overlaps(o, b)) && !others.some((o) => overlaps(o, b));
			};
			let best: { points: Point[]; score: number } | undefined;
			for (let deg = -turn; deg <= turn; deg += TURN_STEP) {
				const a = facing + (deg * Math.PI) / 180;
				const [ax, ay] = [Math.cos(a), Math.sin(a)];
				for (let d = s.size / 2 + k / 2 + EDGE; d <= farthest; d += OUT_STEP) {
					const points = upright
						? shape.map((o) => ({ x: s.seat.x + ax * d + o.x, y: s.seat.y + ay * d + o.y }))
						: shape.map((o) => ({
								x: s.seat.x + ax * (d + o.y) - ay * o.x,
								y: s.seat.y + ay * (d + o.y) + ax * o.x
							}));
					if (!points.every(clear)) continue;
					// Strict: every reminder, not just the group's middle, nearer its own seat.
					if (strict && points.some((p) => nearerOther(p, i))) continue;
					const c = mean(points);
					const own = Math.hypot(c.x - s.seat.x, c.y - s.seat.y);
					let crowding = 0;
					for (let j = 0; j < seats.length; j++) {
						if (j === i) continue;
						const other = Math.hypot(c.x - seats[j].seat.x, c.y - seats[j].seat.y);
						if (loose < 1 && other < own) crowding = Infinity;
						crowding += Math.max(0, 1.6 * seats[j].size - other);
					}
					if (crowding === Infinity) continue;
					const intoMiddle = Math.max(
						0,
						middleRadius - Math.hypot(c.x - s.middle.x, c.y - s.middle.y)
					);
					const score = d + Math.abs(deg) * 0.35 + intoMiddle * 1.5 + crowding * 0.8;
					if (!best || score < best.score) best = { points, score };
					break;
				}
			}
			return best?.points;
		};

		let points: Point[] | undefined;
		let shape = groupShape(s.count, k + GAP);
		// Each reminder nearer its own seat than any other seat with reminders, at a spacing that
		// still leaves each one's middle free to take; then only the group's middle, at each.
		points = place(shape, 0, INWARD, s.size * CLOSE, true);
		// No room close by: whole and full size wherever the board is free, any way round,
		// before any squeezing (Trevor, 2026-11-19, "Spill to free space"). Every reminder still
		// nearer its own seat than any other, so none is taken for a neighbour's (Trevor,
		// 2026-11-19).
		if (!points) {
			fits = false;
			for (const spilled of spillShapes(s.count, k + GAP)) {
				points = place(spilled, 0, SPILL_TURN, s.size * SPILL, true);
				if (points) break;
			}
		}
		// Still no room: a staggered shingle, full size with every label showing, close by and
		// then anywhere a spill may go, before any squeezing (Trevor, 2026-11-19, "add 5").
		if (!points) {
			const shingle = shingleShape(s.count, k);
			points =
				place(shingle, 0, INWARD, s.size * CLOSE * 1.6, true, true) ??
				place(shingle, 0, SPILL_TURN, s.size * SPILL, true, true);
		}
		const tries: [number, boolean][] = [
			[SQUEEZES[1], true],
			...SQUEEZES.map((squeeze): [number, boolean] => [squeeze, false])
		];
		for (const [squeeze, strict] of tries) {
			if (points) break;
			shape = groupShape(s.count, squeeze === 1 ? k + GAP : k * squeeze);
			points = place(shape, 0, INWARD, s.size * CLOSE, strict);
		}
		for (const loose of [0, 1, 2]) {
			if (points) break;
			fits = false;
			points = place(shape, loose, ANYWHERE, s.size * FAR);
		}
		// No room anywhere: below the seat, on the board.
		points ??= shape.map((o) => {
			const p = { x: s.seat.x + o.x, y: s.seat.y + s.size / 2 + k / 2 + EDGE + o.y };
			return board
				? {
						x: Math.min(board.width - k / 2, Math.max(k / 2, p.x)),
						y: Math.min(board.height - k / 2, Math.max(k / 2, p.y))
					}
				: p;
		});
		at[i] = points;
		taken.push(...points.map((p) => ({ ...p, w: k, h: k })));
	}
	return { at, fits };
}
