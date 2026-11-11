/**
 * Drawing and straightening for the live scan spike (Trevor, 2026-11-10): the frozen frame's
 * sheet straightened into a page, where glare lies, and the marks' colours and outlines.
 */
import {
	grayOf,
	homography,
	mapPoint,
	pageSize,
	sheetCorners,
	warp,
	type Point,
	type Rect
} from '#lib/core/photo/frame-checks.ts';

/** The straightened page's long side: about 145 dots an inch on Letter, plenty for 9 point type. */
const PAGE_SIDE = 1600;
/** The corners are found again on a frame this wide before straightening, for a tighter fit. */
const FINE = 480;

/**
 * The frozen frame's sheet straightened into a flat page, and the map from page pixels back
 * to frame pixels; undefined when its corners can't be found again.
 */
export function straighten(frozen: HTMLCanvasElement) {
	const fine = document.createElement('canvas');
	fine.width = FINE;
	fine.height = Math.round((frozen.height * FINE) / frozen.width);
	const fineCtx = fine.getContext('2d', { willReadFrequently: true })!;
	fineCtx.drawImage(frozen, 0, 0, fine.width, fine.height);
	const rgba = fineCtx.getImageData(0, 0, fine.width, fine.height).data;
	const seen = sheetCorners(grayOf(rgba, fine.width, fine.height));
	if (!seen) return undefined;
	const k = frozen.width / FINE;
	const quad = seen.map((p) => ({ x: (p.x + 0.5) * k, y: (p.y + 0.5) * k }));
	const { width, height } = pageSize(quad, PAGE_SIDE);
	const flat = [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height }
	];
	const h = homography(flat, quad);
	if (!h) return undefined;
	const source = frozen
		.getContext('2d', { willReadFrequently: true })!
		.getImageData(0, 0, frozen.width, frozen.height).data;
	const out = document.createElement('canvas');
	out.width = width;
	out.height = height;
	out
		.getContext('2d')!
		.putImageData(
			new ImageData(warp(source, frozen.width, frozen.height, h, width, height), width, height),
			0,
			0
		);
	return { page: out, quad, toFrame: (p: Point) => mapPoint(h, p) };
}

/** Whether any glare patch (in quick-check pixels) lies over the sheet's corners' box. */
export function onSheet(glare: Rect[], toView: number, corners?: Point[]): boolean {
	if (!corners) return glare.length > 0;
	const xs = corners.map((c) => c.x / toView);
	const ys = corners.map((c) => c.y / toView);
	const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	return glare.some((g) => g.x0 < x1 && g.x1 > x0 && g.y0 < y1 && g.y1 > y0);
}

/** The colour of each kind of mark, from the theme. */
export function palette() {
	const css = getComputedStyle(document.documentElement);
	const token = (name: string) => css.getPropertyValue(name).trim();
	return {
		character: token('--good'),
		ability: token('--good'),
		title: token('--accent'),
		unknown: token('--evil'),
		glare: token('--accent'),
		sheet: token('--on-surface')
	};
}

export function outline(ctx: CanvasRenderingContext2D, points: Point[]) {
	ctx.beginPath();
	points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
	ctx.closePath();
}
