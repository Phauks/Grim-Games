/**
 * The board's box maths (GrimoireBoard): converting seat points between % of the board and
 * pixels, where a tether leaves a token, each seat's name box, and the boxes a seat's
 * reminders and the corner's script name keep clear of. Pixels unless a name says %.
 */
import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
import { nameBox, placeNames, type Box, type NamePlace } from './name-placement.ts';

export interface BoardSize {
	width: number;
	height: number;
}

/** A point in % of the board, in pixels. */
export function toPx(p: SeatPoint, board: BoardSize): { x: number; y: number } {
	return { x: (p.x / 100) * board.width, y: (p.y / 100) * board.height };
}

/** A point in pixels, in % of the board. */
export function toPercent(p: { x: number; y: number }, board: BoardSize): SeatPoint {
	return { x: (p.x / board.width) * 100, y: (p.y / board.height) * 100 };
}

/** The point on a seat's rim facing `to`, in % of the board (where a tether starts). */
export function rimToward(
	seat: SeatPoint,
	to: SeatPoint,
	board: BoardSize,
	size: number
): SeatPoint {
	const a = toPx(seat, board);
	const b = toPx(to, board);
	const d = Math.hypot(b.x - a.x, b.y - a.y);
	if (d < 1) return seat;
	const r = Math.min(size / 2, d);
	return toPercent({ x: a.x + ((b.x - a.x) / d) * r, y: a.y + ((b.y - a.y) / d) * r }, board);
}

export interface NameBoxesInput {
	/** Each seat's name as shown ("Seat N" when unnamed), in seating order. */
	names: string[];
	/** Seat centres, in % of the board. */
	seats: SeatPoint[];
	/** Token size. */
	size: number;
	/** The board's spacing unit. */
	unit: number;
	/** The root font size. */
	rootFont: number;
	board: BoardSize;
}

/** Each seat's name, its box in px (the badge: 0.8rem text, padding and border). */
export function nameBoxes(input: NameBoxesInput): { place: NamePlace; box: Box }[] {
	const { names, size, unit, rootFont, board } = input;
	if (board.width <= 0 || board.height <= 0) return [];
	const font = rootFont * 0.8;
	const lineHeight = Math.ceil(font * 1.2 + font * 0.3 + 2);
	const widths = names.map((name) =>
		Math.min(size + 2 * unit, name.length * font * 0.55 + font + 2)
	);
	const centres = input.seats.map((p) => toPx(p, board));
	const places = placeNames({
		seats: centres,
		size,
		widths,
		height: lineHeight,
		obstacles: [],
		board
	});
	return places.map((place, i) => ({
		place,
		box: nameBox(centres[i], place, size, widths[i], lineHeight)
	}));
}

/**
 * What the corner's script name keeps clear of: every token, with the name pill straddling
 * its lower rim (PlayerNameMark) lowered by the badge offset, and every name box.
 */
export function cornerObstacles(
	seats: SeatPoint[],
	names: ({ box: Box } | undefined)[],
	size: number,
	nameOffset: number,
	board: BoardSize
): Box[] {
	return seats.flatMap((p, i) => {
		const c = toPx(p, board);
		const name = names[i]?.box;
		const token = {
			x: c.x,
			y: c.y + (0.05 + nameOffset / 2) * size,
			w: size,
			h: (1.1 + nameOffset) * size
		};
		return name ? [token, name] : [token];
	});
}

export interface AvoidInput {
	/** The seat's centre, in px. */
	centre: { x: number; y: number };
	size: number;
	/** Whether the token shows a character (its name is then a badge on the rim). */
	hasFace: boolean;
	/** The name box, used when the seat has no character. */
	name: Box | undefined;
	dead: boolean;
	note: boolean;
	/** The badge offset (Board and tokens). */
	nameOffset: number;
}

/** What a seat's reminders keep off: its name, a dead seat's skull (SeatDisc), its note mark. */
export function avoidBoxes(input: AvoidInput): Box[] {
	const { centre: c, size } = input;
	const out: Box[] = [];
	if (!input.hasFace) {
		if (input.name) out.push(input.name);
	} else {
		// The badge pill straddles the token's lower rim (PlayerNameMark).
		out.push({ x: c.x, y: c.y + (0.5 + input.nameOffset) * size, w: 0.9 * size, h: 0.18 * size });
	}
	if (input.dead) {
		out.push({ x: c.x - 0.41 * size, y: c.y + 0.37 * size, w: 0.38 * size, h: 0.38 * size });
	}
	// The note mark, lower right (SeatToken).
	if (input.note) {
		out.push({ x: c.x + 0.39 * size, y: c.y + 0.39 * size, w: 0.3 * size, h: 0.3 * size });
	}
	return out;
}

/** A measured box on the board; 0 width means it isn't shown. */
export interface Measured {
	w: number;
	h: number;
}

export interface KeepClearInput {
	/** The Set up button and the Fabled and Loric in the middle. */
	centre: Measured;
	/** Fabled and Loric along the edge or grouped, top left; undefined when they're in the middle. */
	edge: Measured | undefined;
	/** The day timer, top right; undefined when it isn't shown. */
	timer: Measured | undefined;
	/** The script's name, lower left. */
	title: Measured;
	board: BoardSize;
}

/** What every reminder keeps clear of, so those stay clear and tappable; 12px of margin. */
export function keepClear(input: KeepClearInput): Box[] {
	const { centre, edge, timer, title, board } = input;
	const out: Box[] = [];
	if (centre.w > 0)
		out.push({ x: board.width / 2, y: board.height / 2, w: centre.w + 12, h: centre.h + 12 });
	if (edge && edge.w > 0)
		out.push({ x: edge.w / 2, y: edge.h / 2, w: edge.w + 12, h: edge.h + 12 });
	if (timer && timer.w > 0)
		out.push({ x: board.width - timer.w / 2, y: timer.h / 2, w: timer.w + 12, h: timer.h + 12 });
	if (title.w > 0)
		out.push({ x: title.w / 2, y: board.height - title.h / 2, w: title.w + 12, h: title.h + 12 });
	return out;
}
