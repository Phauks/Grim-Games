/**
 * Where a seat's reminders sit on the board: every one is shown (so each can be dragged,
 * however many a seat holds, Trevor 2026-10-16), lined up in front of the seat towards the
 * middle as on a real grimoire. When a line would reach the middle of the table, the rest
 * start a new line beside it, alternating sides, so the reminders fan out instead of
 * stacking. No reminder covers the seat's name or its dead mark. Pixels throughout.
 */
import type { Box } from './name-placement.ts';

export interface FanInput {
	/** The seat's centre. */
	seat: { x: number; y: number };
	/** The middle of the table the reminders face. */
	middle: { x: number; y: number };
	count: number;
	/** Token and reminder diameters. */
	size: number;
	chip: number;
	/** The seat's name and marks (the dead skull), which reminders keep clear of. */
	avoid?: readonly Box[];
}

/** Space between the token and the first reminder, and between reminders. */
const GAP = 6;
const SPACING = 10;

function overlaps(a: Box, b: Box): boolean {
	return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

/** Lines a seat may use before its reminders go wherever is left (12 is far more than needed). */
const MAX_LINES = 12;

/** One seat's places for reminders, best first: its lines in turn, then more lines beside them. */
function candidates(input: FanInput): { x: number; y: number }[] {
	const { seat, middle, count, size, chip, avoid = [] } = input;
	const dx = middle.x - seat.x;
	const dy = middle.y - seat.y;
	const length = Math.hypot(dx, dy);
	const [ux, uy] = length < 1 ? [0, 1] : [dx / length, dy / length];
	// Perpendicular to the line, for the lines beside it.
	const [px, py] = [-uy, ux];
	const pitch = chip + SPACING;
	const first = size / 2 + chip / 2 + GAP;
	// A line stops short of the middle (a seat in the middle still gets three).
	const perLine = Math.max(3, Math.floor((length - chip / 2 - first) / pitch) + 1);
	const lines = Math.max(MAX_LINES, Math.ceil(count / perLine));

	const out: { x: number; y: number }[] = [];
	for (let line = 0; line < lines; line++) {
		// 0, then right, left, further right, further left…
		const side = line === 0 ? 0 : (line % 2 === 1 ? 1 : -1) * Math.ceil(line / 2);
		const offset = side * (chip + SPACING / 2);
		const at = (d: number) => ({
			x: seat.x + ux * d + px * offset,
			y: seat.y + uy * d + py * offset
		});
		// Start the line where it clears the seat's own name and marks.
		let start = first;
		for (let step = 0; step < 60; step++) {
			const box = { ...at(start), w: chip, h: chip };
			if (!avoid.some((a) => overlaps(box, a))) break;
			start += 2;
		}
		for (let k = 0; k < perLine; k++) out.push(at(start + k * pitch));
	}
	return out;
}

/** Spots in rings round the seat, best first: near the seat and facing the middle. */
function around(input: FanInput): { x: number; y: number }[] {
	const { seat, middle, size, chip } = input;
	const towards = Math.atan2(middle.y - seat.y, middle.x - seat.x);
	const reach = Math.max(Math.hypot(middle.x - seat.x, middle.y - seat.y), size + 4 * chip);
	const spots: { x: number; y: number; score: number }[] = [];
	for (let d = size / 2 + chip / 2 + GAP; d <= reach; d += 4) {
		const steps = Math.ceil((2 * Math.PI * d) / 4);
		for (let k = 0; k < steps; k++) {
			const turn = (k / steps) * 2 * Math.PI;
			const a = towards + turn;
			// Facing away from the middle costs up to half as much again.
			const score = d * (1.25 - 0.25 * Math.cos(turn));
			spots.push({ x: seat.x + d * Math.cos(a), y: seat.y + d * Math.sin(a), score });
		}
	}
	return spots.sort((p, q) => p.score - q.score);
}

export function reminderFan(input: FanInput): { x: number; y: number }[] {
	return reminderLayout([input])[0];
}

/**
 * Every seat's reminders at once (Trevor, 2026-10-16): one seat's reminders never cover
 * another seat's reminders, token or name. Seats are laid out in order; a place taken by an
 * earlier seat is skipped, so a crowded seat's line goes on further or starts another line
 * beside it. Only if every line is full does a reminder go on the first place left.
 */
export function reminderLayout(seats: readonly FanInput[]): { x: number; y: number }[][] {
	return layout(seats).at;
}

/**
 * `reminderLayout` on the board, kept clear of `blocked` and inside `board`. Reminders keep
 * their size, since a finger needs the whole tap target: when a seat has no clear room left
 * they go over the edge of its own token first, and only then over something else, always
 * nearer their own seat than any other (Trevor, 2026-10-17).
 */
export function fitReminders(
	seats: readonly FanInput[],
	blocked: readonly Box[] = [],
	board?: { width: number; height: number }
): { at: { x: number; y: number }[][]; fits: boolean } {
	return layout(seats, blocked, board);
}

/** `blocked`: places no reminder may cover, such as the controls in the middle of the table. */
function layout(
	seats: readonly FanInput[],
	blocked: readonly Box[] = [],
	board?: { width: number; height: number }
): { at: { x: number; y: number }[][]; fits: boolean } {
	let fits = true;
	/** What each seat's reminders keep off: other seats' tokens and names, and placed reminders. */
	const own = seats.map((s) => [{ ...s.seat, w: s.size, h: s.size }, ...(s.avoid ?? [])]);
	const placed: Box[][] = seats.map(() => []);
	const at = seats.map((input, i) => {
		if (input.count <= 0) return [];
		const off = [
			...blocked,
			...own.filter((_, j) => j !== i).flat(),
			...placed.filter((_, j) => j !== i).flat()
		];
		const all = candidates(input);
		const box = (p: { x: number; y: number }) => ({ ...p, w: input.chip, h: input.chip });
		// On the board: a reminder past its edge would widen the page.
		const inside = (p: { x: number; y: number }) =>
			!board ||
			(p.x - input.chip / 2 >= 0 &&
				p.y - input.chip / 2 >= 0 &&
				p.x + input.chip / 2 <= board.width &&
				p.y + input.chip / 2 <= board.height);
		// Nearer its own seat than any other (Trevor, 2026-10-17), so whose it is stays clear.
		const own2 = (p: { x: number; y: number }) =>
			(p.x - input.seat.x) ** 2 + (p.y - input.seat.y) ** 2;
		const mine = (p: { x: number; y: number }) =>
			seats.every(
				(other, j) => j === i || (p.x - other.seat.x) ** 2 + (p.y - other.seat.y) ** 2 > own2(p)
			);
		// Never over its own seat's name or marks either.
		const onName = (p: { x: number; y: number }) =>
			(input.avoid ?? []).some((b) => overlaps(box(p), b));
		const clear = (p: { x: number; y: number }) =>
			inside(p) && mine(p) && !onName(p) && !off.some((b) => overlaps(box(p), b));
		const out: { x: number; y: number }[] = [];
		const add = (
			list: readonly { x: number; y: number }[],
			ok: (p: { x: number; y: number }) => boolean
		) => {
			for (const p of list) {
				if (out.length >= input.count) return;
				// Never on top of one of its own.
				if (ok(p) && !out.some((q) => overlaps(box(q), box(p)))) out.push(p);
			}
		};
		add(all, clear);
		// Lines full: any clear spot round the seat, nearest the middle-facing side first.
		if (out.length < input.count) add(around(input), clear);
		if (out.length < input.count) fits = false;
		// Still short: over the edge of its own token, before anything else's.
		add(candidates({ ...input, size: input.size * 0.3 }), clear);
		// Then anywhere round its own token, up to half over it, before leaning towards another.
		add(around({ ...input, size: 0 }), clear);
		// Still short: covering nothing is worth more than being nearest (Trevor, 2026-10-16:
		// never over another player's reminders). The clear spot nearest its own seat, counting
		// any lean towards another seat twice, so whose it is stays as plain as the room allows.
		if (out.length < input.count) {
			const score = (p: { x: number; y: number }) => {
				const mineAt = Math.sqrt(own2(p));
				const nearest = Math.min(
					...seats.map((other, j) =>
						j === i ? Infinity : Math.hypot(p.x - other.seat.x, p.y - other.seat.y)
					)
				);
				return mineAt + 2 * Math.max(0, mineAt - nearest);
			};
			const spots = around({ ...input, size: input.size * 0.3 })
				.filter((p) => inside(p) && !off.some((b) => overlaps(box(p), b)) && !onName(p))
				.map((p) => ({ p, score: score(p) }))
				.sort((a, b) => a.score - b.score)
				.map(({ p }) => p);
			add(spots, () => true);
		}
		// No room left at all: beside its own seat, nearest first, even if it covers another.
		const near = all.filter((p) => inside(p) && mine(p)).sort((a, b) => own2(a) - own2(b));
		add(near, () => true);
		// Even that is full: stack on the nearest places beside its own seat.
		const tightNear = candidates({ ...input, size: input.size * 0.3 })
			.filter((p) => inside(p) && mine(p))
			.sort((a, b) => own2(a) - own2(b));
		const last = tightNear.length > 0 ? tightNear : [input.seat];
		for (let k = 0; out.length < input.count; k++) out.push(last[k % last.length]);
		placed[i] = out.map(box);
		return out;
	});
	return { at, fits };
}
