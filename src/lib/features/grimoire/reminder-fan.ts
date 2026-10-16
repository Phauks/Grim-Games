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
 * `reminderLayout`, with reminders made smaller (down to 60%) when a crowded board has no
 * room to keep them apart at full size. Returns the reminder diameter used.
 */
export function fitReminders(
	seats: readonly FanInput[],
	blocked: readonly Box[] = [],
	board?: { width: number; height: number }
): {
	at: { x: number; y: number }[][];
	chip: number;
} {
	const chip = seats[0]?.chip ?? 0;
	for (const scale of [1, 0.9, 0.8, 0.7, 0.6]) {
		const sized = seats.map((s) => ({ ...s, chip: Math.round(chip * scale) }));
		const tried = layout(sized, blocked, board);
		if (tried.fits || scale === 0.6) return { at: tried.at, chip: Math.round(chip * scale) };
	}
	return { at: layout(seats, blocked, board).at, chip };
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
		const free = all.filter((p) => inside(p) && !off.some((b) => overlaps(box(p), b)));
		if (free.length < input.count) fits = false;
		const out = free.slice(0, input.count);
		const used = new Set(out);
		for (const p of [...all.filter(inside), ...all]) {
			if (out.length >= input.count) break;
			if (!used.has(p)) {
				used.add(p);
				out.push(p);
			}
		}
		placed[i] = out.map(box);
		return out;
	});
	return { at, fits };
}
