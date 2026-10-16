/**
 * Where each player's name goes around their token, so a name is never hidden under a
 * neighbour, a reminder or the screen edge (Trevor, 2026-10-16). Names prefer the outside
 * of the table (reminders sit on the inside), then the sides, then the inside. Each seat
 * takes the first place that is clear, or the one that overlaps least. Pixels throughout.
 */

export type NamePlace = 'below' | 'above' | 'left' | 'right';

/** A rectangle by its centre, width and height. */
export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface NameInput {
	/** Seat centres, in seating order. */
	seats: readonly { x: number; y: number }[];
	/** Token diameter. */
	size: number;
	/** Each name's width and the line height. */
	widths: readonly number[];
	height: number;
	/** Reminders and anything else names should keep off. */
	obstacles: readonly Box[];
	board: { width: number; height: number };
}

/** The gap between a token and its name. */
const GAP = 2;

export function nameBox(
	seat: { x: number; y: number },
	place: NamePlace,
	size: number,
	w: number,
	h: number
): Box {
	const r = size / 2 + GAP;
	switch (place) {
		case 'below':
			return { x: seat.x, y: seat.y + r + h / 2, w, h };
		case 'above':
			return { x: seat.x, y: seat.y - r - h / 2, w, h };
		case 'left':
			return { x: seat.x - r - w / 2, y: seat.y, w, h };
		case 'right':
			return { x: seat.x + r + w / 2, y: seat.y, w, h };
	}
}

function overlap(a: Box, b: Box): number {
	const w = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
	const h = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
	return w > 0 && h > 0 ? w * h : 0;
}

/** How much of a box lies off the board. */
function offBoard(box: Box, board: { width: number; height: number }): number {
	const inside = overlap(box, {
		x: board.width / 2,
		y: board.height / 2,
		w: board.width,
		h: board.height
	});
	return box.w * box.h - inside;
}

/** The places to try for a seat: outwards first, then the sides, then inwards. */
function preference(seat: { x: number; y: number }, board: { width: number; height: number }) {
	const dx = seat.x - board.width / 2;
	const dy = seat.y - board.height / 2;
	const vertical: NamePlace[] = dy >= 0 ? ['below', 'above'] : ['above', 'below'];
	const sideways: NamePlace[] = dx >= 0 ? ['right', 'left'] : ['left', 'right'];
	// A seat at the side of the table looks outwards sideways; otherwise up or down.
	return Math.abs(dx) > Math.abs(dy) * 1.5
		? [sideways[0], vertical[0], vertical[1], sideways[1]]
		: [vertical[0], sideways[0], sideways[1], vertical[1]];
}

export function placeNames(input: NameInput): NamePlace[] {
	const { seats, size, widths, height, obstacles, board } = input;
	const discs: Box[] = seats.map((s) => ({ x: s.x, y: s.y, w: size, h: size }));
	const taken: Box[] = [];
	return seats.map((seat, i) => {
		let best: NamePlace = 'below';
		let bestCost = Infinity;
		for (const place of preference(seat, board)) {
			const box = nameBox(seat, place, size, widths[i] ?? size, height);
			let cost = offBoard(box, board) * 2;
			discs.forEach((d, j) => {
				if (j !== i) cost += overlap(box, d);
			});
			for (const o of obstacles) cost += overlap(box, o);
			for (const t of taken) cost += overlap(box, t);
			if (cost < bestCost) {
				best = place;
				bestCost = cost;
			}
			if (cost === 0) break;
		}
		taken.push(nameBox(seat, best, size, widths[i] ?? size, height));
		return best;
	});
}
