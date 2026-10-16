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

export function reminderFan(input: FanInput): { x: number; y: number }[] {
	const { seat, middle, count, size, chip, avoid = [] } = input;
	if (count <= 0) return [];
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
	const lines = Math.ceil(count / perLine);

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
		const inLine = Math.min(perLine, count - line * perLine);
		for (let k = 0; k < inLine; k++) out.push(at(start + k * pitch));
	}
	return out;
}
