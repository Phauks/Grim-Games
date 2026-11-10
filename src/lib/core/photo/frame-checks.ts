/**
 * Quick checks on one small camera frame, for the live script scan (spike, Trevor 2026-11-10:
 * "hey, glare"): how much the picture moved, where glare is, and the sheet's four corners, so
 * marks drawn on an earlier frame can follow the sheet. Each runs in a few milliseconds on a
 * frame about 160 pixels wide; the slow text reading happens elsewhere.
 */

/** A point in frame pixels. */
export interface Point {
	x: number;
	y: number;
}

/** A rectangle in frame pixels. */
export interface Rect {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** A frame's brightness, 0 to 255 for each pixel, row by row. */
export interface Gray {
	width: number;
	height: number;
	values: Float32Array;
}

/** Brightness of RGBA pixels (as a canvas gives them). */
export function grayOf(rgba: Uint8ClampedArray, width: number, height: number): Gray {
	const values = new Float32Array(width * height);
	for (let i = 0, p = 0; i < values.length; i++, p += 4) {
		values[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
	}
	return { width, height, values };
}

/** How different two frames of the same size are: the mean change in brightness, 0 to 255. */
export function difference(a: Gray, b: Gray): number {
	if (a.width !== b.width || a.height !== b.height) return 255;
	let sum = 0;
	for (let i = 0; i < a.values.length; i++) sum += Math.abs(a.values[i] - b.values[i]);
	return sum / a.values.length;
}

/** A pixel this bright, and nearly colourless, is glare rather than paper. */
const GLARE_LEVEL = 245;
const GLARE_GREY = 24;
/** Cells of this many pixels a side; a cell this full of glare pixels counts as glare. */
const CELL = 6;
const CELL_SHARE = 0.3;

/** The patches of glare in a frame, each as the rectangle around joined glare cells. */
export function glareRects(rgba: Uint8ClampedArray, width: number, height: number): Rect[] {
	const cols = Math.ceil(width / CELL);
	const rows = Math.ceil(height / CELL);
	const lit = new Uint8Array(cols * rows);
	const counts = new Uint16Array(cols * rows);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const p = (y * width + x) * 4;
			const r = rgba[p];
			const g = rgba[p + 1];
			const b = rgba[p + 2];
			const bright = 0.299 * r + 0.587 * g + 0.114 * b;
			if (bright >= GLARE_LEVEL && Math.max(r, g, b) - Math.min(r, g, b) <= GLARE_GREY) {
				counts[Math.floor(y / CELL) * cols + Math.floor(x / CELL)]++;
			}
		}
	}
	for (let i = 0; i < lit.length; i++) lit[i] = counts[i] >= CELL * CELL * CELL_SHARE ? 1 : 0;
	const rects: Rect[] = [];
	const seen = new Uint8Array(lit.length);
	for (let start = 0; start < lit.length; start++) {
		if (!lit[start] || seen[start]) continue;
		const stack = [start];
		seen[start] = 1;
		let [c0, r0, c1, r1] = [cols, rows, 0, 0];
		while (stack.length) {
			const i = stack.pop()!;
			const c = i % cols;
			const r = Math.floor(i / cols);
			[c0, r0, c1, r1] = [Math.min(c0, c), Math.min(r0, r), Math.max(c1, c), Math.max(r1, r)];
			for (const [dc, dr] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nc = c + dc;
				const nr = r + dr;
				const n = nr * cols + nc;
				if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen[n] || !lit[n]) continue;
				seen[n] = 1;
				stack.push(n);
			}
		}
		rects.push({
			x0: c0 * CELL,
			y0: r0 * CELL,
			x1: Math.min(width, (c1 + 1) * CELL),
			y1: Math.min(height, (r1 + 1) * CELL)
		});
	}
	return rects;
}

/** Otsu's threshold: the brightness that best splits the frame into light and dark. */
function threshold(gray: Gray): number {
	const histogram = new Float64Array(256);
	for (const v of gray.values) histogram[Math.min(255, Math.round(v))]++;
	const total = gray.values.length;
	let sum = 0;
	for (let i = 0; i < 256; i++) sum += i * histogram[i];
	let [below, belowSum, best, at] = [0, 0, -1, 128];
	for (let i = 0; i < 256; i++) {
		below += histogram[i];
		if (!below) continue;
		const above = total - below;
		if (!above) break;
		belowSum += i * histogram[i];
		const between = below * above * (belowSum / below - (sum - belowSum) / above) ** 2;
		if (between > best) [best, at] = [between, i];
	}
	return at;
}

/** The sheet must fill at least this share of the frame to be tracked. */
const SHEET_SHARE = 0.12;

/**
 * The sheet's corners, top left, top right, bottom right, bottom left: the largest light patch
 * in the frame, its corners the points furthest out along each diagonal. Undefined when no
 * patch is big enough, or the patch reaches every edge of the frame (the sheet fills the view,
 * so its corners are out of sight).
 */
export function sheetCorners(gray: Gray): Point[] | undefined {
	const { width, height, values } = gray;
	// Light means above the bin Otsu puts on the dark side.
	const level = threshold(gray) + 0.5;
	const labels = new Int32Array(values.length);
	let best: number[] = [];
	let label = 0;
	for (let start = 0; start < values.length; start++) {
		if (labels[start] || values[start] <= level) continue;
		label++;
		const members = [start];
		labels[start] = label;
		for (let k = 0; k < members.length; k++) {
			const i = members[k];
			const x = i % width;
			for (const n of [i - 1, i + 1, i - width, i + width]) {
				if (n < 0 || n >= values.length || labels[n] || values[n] <= level) continue;
				if ((n === i - 1 && x === 0) || (n === i + 1 && x === width - 1)) continue;
				labels[n] = label;
				members.push(n);
			}
		}
		if (members.length > best.length) best = members;
	}
	if (best.length < values.length * SHEET_SHARE) return undefined;
	let [tl, tr, br, bl] = [best[0], best[0], best[0], best[0]];
	const at = (i: number) => ({ x: i % width, y: Math.floor(i / width) });
	const edges = { left: false, right: false, top: false, bottom: false };
	for (const i of best) {
		const { x, y } = at(i);
		const p = (j: number) => at(j);
		if (x + y < p(tl).x + p(tl).y) tl = i;
		if (x + y > p(br).x + p(br).y) br = i;
		if (x - y > p(tr).x - p(tr).y) tr = i;
		if (y - x > p(bl).y - p(bl).x) bl = i;
		edges.left ||= x === 0;
		edges.right ||= x === width - 1;
		edges.top ||= y === 0;
		edges.bottom ||= y === height - 1;
	}
	if (edges.left && edges.right && edges.top && edges.bottom) return undefined;
	return [tl, tr, br, bl].map(at);
}

/** The 3 by 3 projective map (row by row, last entry 1) taking each `from` point to its `to`. */
export function homography(from: readonly Point[], to: readonly Point[]): number[] | undefined {
	const a: number[][] = [];
	for (let k = 0; k < 4; k++) {
		const { x, y } = from[k];
		const { x: u, y: v } = to[k];
		a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
		a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
	}
	// Gaussian elimination with partial pivoting on the 8 by 9 augmented matrix.
	for (let col = 0; col < 8; col++) {
		let pivot = col;
		for (let r = col + 1; r < 8; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
		if (Math.abs(a[pivot][col]) < 1e-9) return undefined;
		[a[col], a[pivot]] = [a[pivot], a[col]];
		for (let r = 0; r < 8; r++) {
			if (r === col) continue;
			const f = a[r][col] / a[col][col];
			for (let c = col; c < 9; c++) a[r][c] -= f * a[col][c];
		}
	}
	return [...a.map((row, i) => row[8] / row[i]), 1];
}

/** Where `h` takes a point. */
export function mapPoint(h: readonly number[], { x, y }: Point): Point {
	const w = h[6] * x + h[7] * y + h[8];
	return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}
