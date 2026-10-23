/**
 * The dark parts of a QR code as one SVG path, in module units (Trevor, 2026-10-23: "options
 * for circles or dots and the like"). The squares can be drawn square, rounded or as dots;
 * the three corner markers (finder patterns) square, rounded or round. Every shape stays
 * inside its own module. Each pair was read back with jsQR, with a logo in the middle, before
 * it was offered.
 */
export type QrModuleShape = 'square' | 'rounded' | 'dot';
export type QrFinderShape = 'square' | 'rounded' | 'circle';

/** A matrix as the QR encoder gives it: `data[row][col]` is a dark module. */
export interface QrMatrix {
	size: number;
	data: boolean[][];
}

/** How wide the quiet border the encoder adds round the code is, in modules. */
const BORDER = 1;
/** A finder pattern is 7 modules square. */
const FINDER = 7;

/** The three finder patterns' top-left corners: top left, top right, bottom left. */
export function finderOrigins(size: number): [number, number][] {
	const far = size - BORDER - FINDER;
	return [
		[BORDER, BORDER],
		[far, BORDER],
		[BORDER, far]
	];
}

const n = (value: number) => Number(value.toFixed(3));

/** A rectangle with corners of radius `r`, drawn clockwise. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
	if (r <= 0) return `M${n(x)},${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
	return (
		`M${n(x + r)},${n(y)}h${n(w - 2 * r)}a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(r)}` +
		`v${n(h - 2 * r)}a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(r)}` +
		`h${n(-(w - 2 * r))}a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(-r)}` +
		`v${n(-(h - 2 * r))}a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(-r)}z`
	);
}

function circle(cx: number, cy: number, r: number): string {
	return `M${n(cx - r)},${n(cy)}a${n(r)},${n(r)} 0 1 0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1 0 ${n(-2 * r)},0z`;
}

function moduleShape(x: number, y: number, shape: QrModuleShape): string {
	// A full-width dot: smaller ones (0.45) left jsQR unable to read the code at all.
	if (shape === 'dot') return circle(x + 0.5, y + 0.5, 0.5);
	return roundedRect(x, y, 1, 1, shape === 'rounded' ? 0.3 : 0);
}

/** One finder: a 7-module ring round a 3-module middle. Drawn with the even-odd rule. */
function finderShape(x: number, y: number, shape: QrFinderShape): string {
	if (shape === 'circle') {
		return (
			circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5) + circle(x + 3.5, y + 3.5, 1.5)
		);
	}
	const [outer, inner, middle] = shape === 'rounded' ? [2, 1.4, 0.9] : [0, 0, 0];
	return (
		roundedRect(x, y, 7, 7, outer) +
		roundedRect(x + 1, y + 1, 5, 5, inner) +
		roundedRect(x + 2, y + 2, 3, 3, middle)
	);
}

/** The whole code's dark parts. Fill it with `fill-rule="evenodd"`, for the finders' rings. */
export function qrPath(
	matrix: QrMatrix,
	modules: QrModuleShape = 'square',
	finders: QrFinderShape = 'square'
): string {
	const origins = finderOrigins(matrix.size);
	const inFinder = (row: number, col: number) =>
		origins.some(([x, y]) => col >= x && col < x + FINDER && row >= y && row < y + FINDER);
	const parts: string[] = [];
	for (let row = 0; row < matrix.size; row++) {
		for (let col = 0; col < matrix.size; col++) {
			if (matrix.data[row][col] && !inFinder(row, col)) parts.push(moduleShape(col, row, modules));
		}
	}
	for (const [x, y] of origins) parts.push(finderShape(x, y, finders));
	return parts.join('');
}
